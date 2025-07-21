import fetch from "node-fetch";
import { config } from "dotenv";
import { TwitterApi } from "twitter-api-v2";
import fs from "fs/promises";
import OpenAI from "openai";

config(); // Load env variables

// --- Twitter client (v1.1 compatible)
const client = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_KEY_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET,
});
const rwClient = client.readWrite.v1;

// --- OpenAI client
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// --- Utility: load previously tweeted titles
async function loadPostedTitles() {
  try {
    const data = await fs.readFile("posted.json", "utf-8");
    return JSON.parse(data);
  } catch {
    return [];
  }
}

async function savePostedTitles(titles) {
  await fs.writeFile("posted.json", JSON.stringify(titles.slice(-50))); // Keep last 50
}

// --- Fetch top Indian and global news
async function getFreshNews() {
  try {
    const url = `https://newsapi.org/v2/top-headlines?language=en&country=in&pageSize=10&apiKey=${process.env.NEWS_API_KEY}`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.articles || data.articles.length === 0) {
      console.error("❌ No articles found.");
      return null;
    }

    const postedTitles = await loadPostedTitles();
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

    const freshArticle = data.articles.find(
      a =>
        a.title &&
        a.url &&
        !postedTitles.includes(a.title) &&
        new Date(a.publishedAt) > oneHourAgo
    );

    return freshArticle || null;
  } catch (err) {
    console.error("❌ Error fetching news:", err);
    return null;
  }
}

// --- Use OpenAI to make engaging tweet
async function generateTweet(article) {
  const prompt = `Rewrite the following news headline to make it more engaging and attention-grabbing for Twitter (max 250 characters). Add a little suspense or curiosity but don't lie. Then append the original article link:\n\n"${article.title}"\n\nURL: ${article.url}`;

  const completion = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.7,
    max_tokens: 150,
  });

  return completion.choices[0]?.message?.content?.trim();
}

// --- Main tweet logic
async function postTweet() {
  const article = await getFreshNews();
  if (!article) {
    console.log("🛑 No fresh news to post.");
    return;
  }

  const tweetContent = await generateTweet(article);

  try {
    const tweet = await rwClient.tweet(tweetContent);
    console.log("✅ Tweet posted:", tweet.id_str);

    const postedTitles = await loadPostedTitles();
    postedTitles.push(article.title);
    await savePostedTitles(postedTitles);
  } catch (err) {
    console.error("❌ Failed to post tweet:", err);
  }
}

// --- Run once
postTweet();
