import fs from 'fs';
import axios from 'axios';
import dotenv from 'dotenv';
import express from 'express';
import { TwitterApi } from 'twitter-api-v2';
import OpenAI from 'openai';

dotenv.config();

// Load posted URLs from posted.txt
let posted = new Set();
try {
  const data = fs.readFileSync('posted.txt', 'utf-8');
  posted = new Set(data.split('\n').filter(line => line.trim() !== ''));
} catch {
  console.log('No posted.txt found, starting fresh.');
}

// Save posted URL to file
function savePosted(url) {
  if (!posted.has(url)) {
    posted.add(url);
    fs.appendFileSync('posted.txt', url + '\n');
  }
}

// Track image generation (reset daily)
let imageCount = 0;
let lastResetDay = new Date().getDate();
function resetImageCountIfNeeded() {
  const today = new Date().getDate();
  if (today !== lastResetDay) {
    imageCount = 0;
    lastResetDay = today;
  }
}

// OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Twitter client
const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_KEY_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});

// Tweet function with or without image
async function postTweet(text, imageUrl = null) {
  try {
    if (imageUrl) {
      const image = await axios.get(imageUrl, { responseType: 'arraybuffer' });
      const mediaId = await twitterClient.v1.uploadMedia(Buffer.from(image.data), { type: 'png' });

      await twitterClient.v2.tweet({
        text,
        media: { media_ids: [mediaId] },
      });
    } else {
      await twitterClient.v2.tweet(text);
    }
    console.log('✅ Tweeted:\n', text);
  } catch (err) {
    console.error('❌ Twitter error:', err);
  }
}

// Get headlines only from selected countries
async function getTopHeadlines() {
  const countries = ['in', 'pk', 'us', 'cn', 'ru'];
  let articles = [];

  for (const country of countries) {
    try {
      const response = await axios.get('https://newsapi.org/v2/top-headlines', {
        params: {
          language: 'en',
          pageSize: 3,
          sortBy: 'publishedAt',
          country,
          apiKey: process.env.NEWS_API_KEY,
        },
      });
      articles = articles.concat(response.data.articles);
    } catch (err) {
      console.error(`❌ News API error (${country}):`, err.message);
    }
  }

  return articles;
}

// Rewrite news into tweet using GPT
async function rewriteWithGPT(article) {
  const indianStates = ["Punjab", "Gujarat", "Karnataka", "West Bengal", "Maharashtra", "Uttar Pradesh", "Kerala", "Tamil Nadu", "Rajasthan", "Delhi"];
  const famousPeople = ["NSA Ajit Doval", "PM Modi", "Dr. S. Jaishankar", "Kiren Rijiju", "Nandan Nilekani", "Raghuram Rajan", "K. Sivan", "Dr. APJ Abdul Kalam"];
  const randomState = indianStates[Math.floor(Math.random() * indianStates.length)];
  const randomPerson = famousPeople[Math.floor(Math.random() * famousPeople.length)];

  const prompt = `
You're a social media editor for a breaking news alert account.

Create a bold, urgent tweet under 280 characters using the article below.

1. Start with 🚨 BREAKING: if serious.
2. Be click-worthy.
3. Use 1-2 hashtags.
4. Mention "${randomState}" or "${randomPerson}" only if natural.
5. No links.
6. End with: Follow @IntelOfWorld for real-time global alerts.

News Title: ${article.title}
Description: ${article.description || ''}

Tweet:
`;

  try {
    const completion = await openai.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-4',
      max_tokens: 140,
      temperature: 0.8,
    });

    return completion.choices[0].message.content.trim();
  } catch (err) {
    console.error('❌ GPT error:', err.message);
    return null;
  }
}

// Generate image if urgent
async function maybeGenerateImage(prompt) {
  resetImageCountIfNeeded();
  if (imageCount >= 3) return null;

  try {
    const result = await openai.images.generate({
      prompt: `Realistic breaking news illustration: ${prompt}`,
      n: 1,
      size: '1024x1024',
    });

    const imageUrl = result.data[0]?.url;
    if (imageUrl) {
      imageCount++;
      return imageUrl;
    }
  } catch (err) {
    console.error('❌ Image generation error:', err.message);
  }

  return null;
}

// Main bot loop
async function runBot() {
  const articles = await getTopHeadlines();

  for (const article of articles) {
    if (!article.url || posted.has(article.url)) continue;

    const tweet = await rewriteWithGPT(article);
    if (!tweet) continue;

    const keywords = ["explosion", "attack", "earthquake", "blast", "flood", "fire", "crash", "strike"];
    const trigger = keywords.some(word => article.title.toLowerCase().includes(word));

    const imageUrl = trigger ? await maybeGenerateImage(article.title) : null;

    await postTweet(tweet, imageUrl);
    savePosted(article.url);
    break; // one tweet per run
  }
}

// Run every 90 mins
setInterval(runBot, 90 * 60 * 1000);
runBot();

// Keep-alive server
const app = express();
app.get('/', (req, res) => res.send('🟢 GlobalIntel bot is live.'));
app.listen(process.env.PORT || 3000);
