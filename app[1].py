from flask import Flask, render_template, request, jsonify
import sqlite3
from pathlib import Path

app = Flask(__name__)
DB_PATH = Path(__file__).with_name("sky_striker.db")

def get_connection():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    return connection

def create_table():
    with get_connection() as connection:
        connection.execute("""
            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_name TEXT NOT NULL,
                score INTEGER NOT NULL,
                stage INTEGER NOT NULL,
                played_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        """)

@app.route("/")
def home():
    return render_template("index.html")

@app.get("/leaderboard")
def leaderboard():
    with get_connection() as connection:
        rows = connection.execute("""
            SELECT player_name, MAX(score) AS score, MAX(stage) AS stage
            FROM scores
            GROUP BY player_name
            ORDER BY score DESC
            LIMIT 10
        """).fetchall()
    return jsonify([dict(row) for row in rows])

@app.post("/save-score")
def save_score():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "Pilot")).strip()[:20] or "Pilot"
    try:
        score = max(0, min(int(data.get("score", 0)), 1000000))
        stage = max(1, min(int(data.get("stage", 1)), 3))
    except (TypeError, ValueError):
        return jsonify({"ok": False, "message": "Invalid score data"}), 400

    with get_connection() as connection:
        connection.execute(
            "INSERT INTO scores (player_name, score, stage) VALUES (?, ?, ?)",
            (name, score, stage)
        )
    return jsonify({"ok": True, "message": "Score saved"})

if __name__ == "__main__":
    create_table()
    app.run(debug=True)
