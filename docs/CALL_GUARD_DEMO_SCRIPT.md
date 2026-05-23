# Call Guard — Demo “Scammer” Script

Use this script for live testing with a teammate on **Google Meet** or **Microsoft Teams (web)**. The person reading the script plays the **scammer**; you are the **victim** testing MakGuard.

## Setup

1. Install / reload the MakGuard Chrome extension (v1.1.0+).
2. Open extension popup → ensure **Protection** and **Call Guard** are ON.
3. Join a meeting in Chrome: [meet.google.com](https://meet.google.com) or [teams.microsoft.com](https://teams.microsoft.com).
4. Click **Start listening** on the MakGuard Call Guard panel (bottom-right).
5. Allow **microphone** when prompted. Use **speakers** (not muted headphones) so your mic picks up the scammer’s voice, or share the scammer’s audio into the call.
6. Scammer reads the script clearly, slightly slower than normal conversation.

## Full script (2–3 minutes)

> Hello, good afternoon. Am I speaking to Puan Siti?
>
> My name is Ahmad, calling from **Maybank Card Centre**, Kuala Lumpur branch. Your Maybank credit card ending 4821 has been flagged for **suspicious online transactions** totalling **RM8,450** in the last two hours.
>
> Your account will be **frozen within thirty minutes** unless we verify this now. This is very **urgent** — **PDRM** and **Bank Negara** are already investigating similar cases in your area.
>
> I need you to read me the **six-digit TAC code** that Maybank just sent to your phone. Do not tell anyone else — this is for verification only.
>
> If you did not make these purchases, we must **transfer your balance immediately** to a **Bank Negara safe holding account**. I will give you the account number now: **5148392017**, account name "BNM Security Unit."
>
> Please **stay on the line**. Do not call the number on the back of your card — those lines are compromised. If you hang up, your account will be **permanently suspended** and you may face **legal action**.
>
> Can you open your **MAE app** now and **transfer RM12,000** to the safe account while I stay on the line? I need you to do this in the **next ten minutes**.

## Short script (30 seconds — backup)

> This is Officer Razak from **PDRM Cyber Crime Division**. Your IC has been linked to money laundering. We need your **online banking password and TAC** now or a warrant will be issued today. **Transfer RM5,000** to account **60123456789** immediately to clear your name.

## Expected MakGuard behaviour

- Within about **20–40 seconds** after scam keywords appear in the transcript, risk score should reach **61+**.
- A **red alert banner** appears: “Potential scam call — hang up”.
- Extension toolbar shows a red **!** badge.

## Backup: dashboard demo (no live call)

1. Open [makguard.vercel.app/dashboard](https://makguard.vercel.app/dashboard) → **Call Guard** tab.
2. Click **Load demo script** → **Run analysis**.
3. Use this if Wi‑Fi or speech recognition fails on demo day.

## Tips for teammates playing the scammer

- Speak in a calm, official tone (not cartoon-villain).
- Emphasise: **Maybank**, **TAC**, **urgent**, **transfer**, **PDRM**, **safe account**.
- Pause 1–2 seconds between paragraphs so speech-to-text can keep up.
- Do not improvise too much in the first test — stick to the script until Call Guard is confirmed working.
