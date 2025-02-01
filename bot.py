import os
import telebot
import json
import requests
import logging
import time
from pymongo import MongoClient
from datetime import datetime, timedelta
import certifi
import asyncio
from telebot.types import ReplyKeyboardMarkup, KeyboardButton
from threading import Thread

# Set up asyncio loop
loop = asyncio.get_event_loop()

# Fetch environment variables securely
TOKEN = os.getenv("7114207827:AAFD1_RrCziYGNFqrVCW2idxWLXVFhOgKZg")
MONGO_URI = os.getenv("mongodb+srv://Bishal:Bishal@bishal.dffybpx.mongodb.net/?retryWrites=true&w=majority&appName=Bishal")

FORWARD_CHANNEL_ID = -1001826672472
CHANNEL_ID = -1001826672472
ERROR_CHANNEL_ID = -1001826672472

# Logging configuration
logging.basicConfig(format='%(asctime)s - %(name)s - %(levelname)s - %(message)s', level=logging.INFO)

# Database connection
client = MongoClient(MONGO_URI, tlsCAFile=certifi.where())
db = client['Bishal']
users_collection = db.users

# Initialize bot
bot = telebot.TeleBot(TOKEN)
REQUEST_INTERVAL = 1

# Function to check if a user is an admin
def is_user_admin(user_id, chat_id):
    try:
        return bot.get_chat_member(chat_id, user_id).status in ['administrator', 'creator']
    except:
        return False



def is_user_admin(user_id, chat_id):
    try:
        return bot.get_chat_member(chat_id, user_id).status in ['administrator', 'creator']
    except:
        return False

def check_user_approval(user_id):
    user_data = users_collection.find_one({"user_id": user_id})
    return bool(user_data and user_data.get('plan', 0) > 0)

def send_not_approved_message(chat_id):
    bot.send_message(chat_id, "*YOU ARE NOT APPROVED! CONTACT ADMIN FOR ACCESS.*", parse_mode='Markdown')

@bot.message_handler(commands=['approve', 'disapprove'])
def approve_or_disapprove_user(message):
    user_id = message.from_user.id
    chat_id = message.chat.id
    is_admin = is_user_admin(user_id, CHANNEL_ID)
    cmd_parts = message.text.split()

    if not is_admin:
        bot.send_message(chat_id, "*You are not authorized to use this command*", parse_mode='Markdown')
        return

    if len(cmd_parts) < 2:
        bot.send_message(chat_id, "*Invalid command format. Use /approve <user_id> <plan> <days> or /disapprove <user_id>.*", parse_mode='Markdown')
        return

    action = cmd_parts[0]
    target_user_id = int(cmd_parts[1])
    plan = int(cmd_parts[2]) if len(cmd_parts) >= 3 else 0
    days = int(cmd_parts[3]) if len(cmd_parts) >= 4 else 0

    if action == '/approve':
        valid_until = (datetime.now() + timedelta(days=days)).date().isoformat() if days > 0 else datetime.now().date().isoformat()
        users_collection.update_one(
            {"user_id": target_user_id},
            {"$set": {"plan": plan, "valid_until": valid_until, "access_count": 0}},
            upsert=True
        )
        msg_text = f"*User {target_user_id} approved with plan {plan} for {days} days.*"
    else:
        users_collection.update_one(
            {"user_id": target_user_id},
            {"$set": {"plan": 0, "valid_until": "", "access_count": 0}},
            upsert=True
        )
        msg_text = f"*User {target_user_id} disapproved and reverted to free.*"

    bot.send_message(chat_id, msg_text, parse_mode='Markdown')
    bot.send_message(CHANNEL_ID, msg_text, parse_mode='Markdown')

@bot.message_handler(commands=['start'])
def send_welcome(message):
    markup = ReplyKeyboardMarkup(row_width=2, resize_keyboard=True, one_time_keyboard=True)

    btn1 = KeyboardButton("ℹ️ My Info")
    btn2 = KeyboardButton("💼 ResellerShip")
    btn3 = KeyboardButton("Contact Admin ✔️")

    markup.add(btn1, btn2, btn3)

    bot.send_message(message.chat.id, "*🚀 Welcome to the Secure Bot 🚀*", reply_markup=markup, parse_mode='Markdown')



@bot.message_handler(commands=['test'])
def test_command(message):
    chat_id = message.chat.id
    user_id = message.from_user.id

    if not is_user_admin(user_id, CHANNEL_ID):
        bot.send_message(chat_id, "*You are not authorized to use this command*", parse_mode='Markdown')
        return
    
    cmd_parts = message.text.split()
    if len(cmd_parts) < 5:
        bot.send_message(chat_id, "*Invalid command format. Use /test <name> <sername> <time> <duration>*", parse_mode='Markdown')
        return
    
    name = cmd_parts[1]
    sername = cmd_parts[2]
    test_time = cmd_parts[3]
    duration = cmd_parts[4]
    
    command = f"./bgmi {name} {sername} {test_time} {duration} 100"
    os.system(command)
  #  bot.send_message(chat_id, f"*Executed:* `{command}`", parse_mode='Markdown')

@bot.message_handler(commands=['start'])
def send_welcome(message):
    markup = ReplyKeyboardMarkup(row_width=2, resize_keyboard=True, one_time_keyboard=True)
    
    btn1 = KeyboardButton("ℹ️ My Info")
    btn2 = KeyboardButton("💼 ResellerShip")
    btn3 = KeyboardButton("Contact Admin ✔️")
    
    markup.add(btn1, btn2, btn3)
    
    bot.send_message(message.chat.id, "*🚀 Welcome to the Secure Bot 🚀*", reply_markup=markup, parse_mode='Markdown')

@bot.message_handler(func=lambda message: True)
def handle_message(message):
    if message.text == "ℹ️ My Info":
        bot.reply_to(message, "*User Info Section*", parse_mode='Markdown')
    elif message.text == "💼 ResellerShip":
        bot.send_message(message.chat.id, "*For Reseller Ship, Contact Admin!*", parse_mode='Markdown')
    elif message.text == "Contact Admin ✔️":
        bot.reply_to(message, "*Contact Admin Selected*", parse_mode='Markdown')
    else:
        bot.reply_to(message, "*Invalid option*", parse_mode='Markdown')

def start_asyncio_thread():
    asyncio.set_event_loop(loop)
    loop.run_until_complete(asyncio.sleep(REQUEST_INTERVAL))

if __name__ == "__main__":
    asyncio_thread = Thread(target=start_asyncio_thread, daemon=True)
    asyncio_thread.start()
    logging.info("Secure Bot is Running...")
    
    while True:
        try:
            bot.polling(none_stop=True, interval=3, timeout=20)
        except Exception as e:
            logging.error(f"An error occurred while polling: {e}")
        time.sleep(REQUEST_INTERVAL)
