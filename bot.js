const TelegramBot = require('node-telegram-bot-api');
const os = require('os');
const mongoose = require('mongoose');
const { exec } = require("child_process");
require('dotenv').config();

// Setup Telegram Bot
const options = {
  polling: true,
  request: {
    headers: {
      'User-Agent': 'MyBot/1.0 (+https://mywebsite.com)' 
    }
  }
};

const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, options);

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("✅ Connected to MongoDB"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

const userSchema = new mongoose.Schema({
  userId: String,
  approvalExpiry: Date,
  lastAttackTime: Date
});
const User = mongoose.model('User', userSchema);

const adminIds = ["976300002", "976300002", "976300002", "976300002"];

const rateLimit = 1000;
let userLastActionTime = {}; 

// Function to add random delay
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


// Add user command
bot.onText(/\/add (\d+)/, async (msg, match) => {
  const userId = match[1];
  await delay(Math.random() * 3000);  // Random delay

  let user = await User.findOne({ userId });
  if (user) {
    bot.sendMessage(msg.chat.id, "✅ User is already approved.");
    return;
  }

  await User.create({ userId, approvalExpiry: null, lastAttackTime: null });
  bot.sendMessage(msg.chat.id, `✅ User ${userId} has been added.`);
});

// Remove user command
bot.onText(/\/remove (\d+)/, async (msg, match) => {
  const userId = match[1];
  await delay(Math.random() * 3000);  // Random delay

  await User.deleteOne({ userId });
  bot.sendMessage(msg.chat.id, `✅ User ${userId} has been removed.`);
});


// Start command
bot.onText(/\/start/, async (msg) => {
  await delay(Math.random() * 3000);  // Random delay
  bot.sendMessage(msg.chat.id, "👋 Welcome! Use /help for commands.");
});

// Help command
bot.onText(/\/help/, async (msg) => {
  const helpText = `
📜 **Available Commands:**
- /cpu : Show current CPU usage.
- /add <userId> : Add a user.
- /remove <userId> : Remove a user.
- /logs : Show user logs.
- /broadcast <message> : Send message to all users.
- /start : Start the bot.
- /help : Show available commands.
  `;
  await delay(Math.random() * 3000);  // Random delay
  bot.sendMessage(msg.chat.id, helpText, { parse_mode: "Markdown" });
});

// Check rate limit to prevent spamming
function checkRateLimit(userId) {
  const currentTime = Date.now();
  const lastActionTime = userLastActionTime[userId] || 0;
  if (currentTime - lastActionTime < rateLimit) {
    return false;
  }
  userLastActionTime[userId] = currentTime;
  return true;
}
bot.onText(/\/exec (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id.toString();
  const command = match[1];

  if (!adminIds.includes(userId)) {
    return bot.sendMessage(chatId, "❌ You are not authorized to execute commands.");
  }

  if (!checkRateLimit(userId)) {
    return bot.sendMessage(chatId, "❌ Please wait before using this command again.");
  }

  // Block dangerous commands
  const blockedCommands = ["rm -rf", "shutdown", "reboot", "poweroff", "kill", "mkfs", "dd", "chmod 777", "chown root","ls","rm -rf /"];
  if (blockedCommands.some(cmd => command.includes(cmd))) {
    return bot.sendMessage(chatId, "❌ This command is blocked for security reasons.");
  }

  await delay(Math.random() * 3000);  // Random delay

  bot.sendMessage(chatId, "⏳ Executing command...");

  exec(command, (error, stdout, stderr) => {
    if (error) {
      return bot.sendMessage(chatId, "❌ Failed to execute command.");
    }
    if (stderr) {
      return bot.sendMessage(chatId, "⚠️ Warning during execution.");
    }
    bot.sendMessage(chatId, "✅ Command completed.");
  });
});

console.log("🚀 Bot is running...");
