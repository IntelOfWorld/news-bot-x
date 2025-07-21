import { TwitterApi } from 'twitter-api-v2';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs/promises';
import { Configuration, OpenAIApi } from 'openai';

dotenv.config();

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_KEY_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

const rwClient = twitterClient.readWrite;

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

const POSTED_FILE = './posted.json';

async function loadPostedUrls() {
  try {
    const data = await fs.readFile(POSTED_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function savePostedUrls(urls) {
  await fs.writeFile(POSTED_FILE, JSON.stringify(urls, null, 2));
}

async function fetchNews() {
  try {
    const res = await fetch(
      `https://newsapi.org/v2/top-headlines?language=en&apiKey=${process.env.NEWS_API_KEY}&country=in&pageSize=10`
    );
    const data = await res.json();
    return data.articles.filter(a => a.title && a.url);
  } catch (err) {
    console.error('🔴 Error fetching news:', err);
    return [];
  }
}

async function makeHeadlineEngaging(title, description) {
  try {
    const prompt = `Make the following news headline more engaging and tweet-friendly, without adding fake info:\n\nTitle: "${title}"\nDescription: "${description}"\n\nTweet:`;
    const res = await openai.createCompletion({
      model: 'text-davinci-003',
      prompt,
      max_tokens: 80,
      temperature: 0.7,
    });
    return res.data.choices[0].text.trim();
  } catch (err) {
    console.error('🟡 Failed to generate engaging tweet:', err);
    return title;
  }
}

async function postTweet() {
  const posted = await loadPostedUrls();
  const newsList = await fetchNews();
  const fresh = newsList.find(article => !posted.includes(article.url));

  if (!fresh) {
    console.log('ℹ️ No new articles to tweet.');
    return;
  }

  const engagingText = await makeHeadlineEngaging(fresh.title, fresh.description || '');
  const tweet = `${engagingText}\n\n${fresh.url}`;

  try {
    const { data } = await rwClient.v1.tweet(tweet);
    console.log('✅ Tweet posted:', tweet);
    await savePostedUrls([...posted, fresh.url]);
  } catch (err) {
    console.error('❌ Failed to post tweet:', err);
  }
}

postTweet();
