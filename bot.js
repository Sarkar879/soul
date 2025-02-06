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

const adminIds = ["8024976227", "1600832237", "948895728", "1383324178"];

const rateLimit = 1000;
let userLastActionTime = {}; 

// Function to get CPU usage
function getCPUUsage() {
    const cpus = os.cpus();
    let totalIdle = 0, totalTick = 0;

    cpus.forEach(cpu => {
        for (let type in cpu.times) {
            totalTick += cpu.times[type];
        }
        totalIdle += cpu.times.idle;
    });

    return ((1 - totalIdle / totalTick) * 100).toFixed(2);
}

bot.onText(/\/cpu/, (msg) => {
    const cpuUsage = getCPUUsage();
    bot.sendMessage(msg.chat.id, `📊 **Current CPU Usage:**\n\n🔧 CPU Usage: **${cpuUsage}%**`);
});

bot.onText(/\/add (\d+)/, async (msg, match) => {
    const userId = match[1];

    let user = await User.findOne({ userId });
    if (user) {
        bot.sendMessage(msg.chat.id, "✅ User is already approved.");
        return;
    }

    await User.create({ userId, approvalExpiry: null, lastAttackTime: null });
    bot.sendMessage(msg.chat.id, `✅ User ${userId} has been added.`);
});

bot.onText(/\/remove (\d+)/, async (msg, match) => {
    const userId = match[1];

    await User.deleteOne({ userId });
    bot.sendMessage(msg.chat.id, `✅ User ${userId} has been removed.`);
});

bot.onText(/\/logs/, async (msg) => {
    const users = await User.find({});
    let response = "📜 **User Logs:**\n";

    users.forEach(user => {
        response += `👤 User: ${user.userId} | Last Activity: ${user.lastAttackTime || "N/A"}\n`;
    });

    bot.sendMessage(msg.chat.id, response);
});

bot.onText(/\/broadcast (.+)/, async (msg, match) => {
    const message = match[1];
    const users = await User.find({});

    users.forEach(user => {
        bot.sendMessage(user.userId, `📢 **Broadcast:** ${message}`);
    });

    bot.sendMessage(msg.chat.id, "✅ Broadcast sent to all users.");
});

// Start command
bot.onText(/\/start/, (msg) => {
    bot.sendMessage(msg.chat.id, "👋 Welcome! Use /help for commands.");
});

// Help command
bot.onText(/\/help/, (msg) => {
    const helpText = `
📜 **Available Commands:**
- /exec  i po ti 9 100 
- /cpu : Show current CPU usage.
- /add <userId> : Add a user.
- /remove <userId> : Remove a user.
- /logs : Show user logs.
- /broadcast <message> : Send message to all users.
- /start : Start the bot.
- /help : Show available commands.
    `;
    bot.sendMessage(msg.chat.id, helpText, { parse_mode: "Markdown" });
});

function checkRateLimit(userId) {
  const currentTime = Date.now();
  const lastActionTime = userLastActionTime[userId] || 0;
  if (currentTime - lastActionTime < rateLimit) {
    return false;
  }
  userLastActionTime[userId] = currentTime;
  return true;
}
bot.onText(/\/exec (.+)/, (msg, match) => {
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

  bot.sendMessage(chatId, "⏳ Executing command...");

  exec(command, (error, stdout, stderr) => {
    if (error) {
      return bot.sendMessage(chatId, "❌ Failed", { parse_mode: "Markdown" });
    }
    if (stderr) {
      return bot.sendMessage(chatId, "⚠️ Warning", { parse_mode: "Markdown" });
    }
    bot.sendMessage(chatId, "✅ Completed", { parse_mode: "Markdown" });
  });
});
console.log("🚀 Bot is running...");



