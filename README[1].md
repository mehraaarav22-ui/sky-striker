# SKY STRIKER – Class 12 Computer Science Project

A small browser-based arcade flying shooter built with Python (Flask), SQLite, HTML, CSS and JavaScript Canvas.

## Features
- Three stages: Beginner, Advanced and Expert
- Continuously scrolling space background
- Keyboard-controlled spaceship
- Shooting enemies, dodging asteroids and a final boss
- Three lives and a score display
- SQLite leaderboard that stores player name, score, stage and date

## Requirements
- Python 3.9 or newer
- Internet connection is optional for the game itself. The font in the design uses Google Fonts; it falls back to system fonts if offline.

## How to run

1. Extract the ZIP file.
2. Open a terminal / Command Prompt in the `sky_striker_project` folder.
3. Install Flask:

   ```bash
   pip install -r requirements.txt
   ```

4. Start the website:

   ```bash
   python app.py
   ```

5. Open this address in your browser:

   `http://127.0.0.1:5000`

The SQLite database file `sky_striker.db` is created automatically when the app starts.

## Controls
- Move: W, A, S, D or arrow keys
- Fire: Spacebar

## Database table

Table name: `scores`

| Column | Type | Description |
|---|---|---|
| id | INTEGER | Unique record number |
| player_name | TEXT | Player's callsign |
| score | INTEGER | Final score |
| stage | INTEGER | Highest stage reached |
| played_at | TIMESTAMP | Date and time of the game |

The Python backend uses parameterized SQL queries when saving scores.

## Suggested project explanation for viva

- **Why Flask?** It connects the Python backend to the website routes.
- **Why SQLite?** It is a lightweight SQL database that does not need a separate database server.
- **Why JavaScript Canvas?** It draws and updates the game smoothly in the browser.
- **How is the score stored?** The browser sends the final score to a Flask route, which inserts it into the SQLite `scores` table.


## Mobile controls
- **Touch steering:** Touch and drag on the game screen to move the spaceship.
- **Hold to fire:** Press and hold the on-screen FIRE button.
- **Gyroscope:** Tap ENABLE GYRO, allow motion access if prompted, then tilt the phone left/right to steer.
- On iPhone/iPad, gyro access may require a permission prompt and a secure context. If gyro is unavailable, touch steering still works.
- For reliable mobile sensor access, use HTTPS when hosting the project. The local `http://127.0.0.1` address is generally treated as a secure local context on the same device.
