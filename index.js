const express = require("express");
const axios = require("axios");
const { TwitterApi } = require("twitter-api-v2");
const OpenAI = require("openai");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

const twitterClient = new TwitterApi({
  appKey: process.env.TWITTER_API_KEY,
  appSecret: process.env.TWITTER_API_SECRET,
  accessToken: process.env.TWITTER_ACCESS_TOKEN,
  accessSecret: process.env.TWITTER_ACCESS_SECRET,
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let lastTweetTime = "Not yet posted.";

async function fetchNews() {
  try {
    const response = await axios.get(
      `https://newsdata.io/api/1/news?apikey=${process.env.NEWSDATA_API_KEY}&country=in,us,gb&language=en&category=top`
    );
    const articles = response.data.results;

    if (!articles || articles.length === 0) return null;

    for (const article of articles) {
      if (article.title && article.link) {
        return `${article.title} — ${article.link}`;
      }
    }

    return null;
  } catch (error) {
    console.error("❌ Error fetching news:", error.message);
    return null;
  }
}

async function generateTweet(text) {
  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: "Rewrite this news title and link into a tweet under 280 characters, slightly witty, slightly India-biased, and globally relevant.",
        },
        { role: "user", content: text },
      ],
    });

    return completion.choices[0].message.content;
  } catch (error) {
    console.error("❌ Error generating tweet:", error.message);
    return null;
  }
}

async function postTweet() {
  const news = await fetchNews();
  if (!news) return;

  const tweet = await generateTweet(news);
  if (!tweet) return;

  try {
    await twitterClient.v2.tweet(tweet);
    lastTweetTime = new Date().toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
    });
    console.log("✅ Tweet posted at", lastTweetTime);
  } catch (error) {
    console.error("❌ Error posting tweet:", error.message);
  }
}

app.get("/", async (req, res) => {
  await postTweet();
  res.send(`✅ Tweet attempted at ${lastTweetTime}`);
});

app.get("/status", (req, res) => {
  res.send(`🕒 Last tweet was posted at: ${lastTweetTime}`);
});

app.listen(port, () => {
  console.log(`🔁 Bot running on port ${port}`);
});
