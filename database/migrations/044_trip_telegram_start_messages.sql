CREATE TABLE IF NOT EXISTS trip_telegram_start_messages (
  trip_id INTEGER NOT NULL REFERENCES viajes(id_viajes),
  chat_id TEXT NOT NULL,
  bot_id TEXT NOT NULL,
  message_id BIGINT NOT NULL CHECK (message_id > 0),
  thread_id BIGINT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (trip_id, chat_id, bot_id)
);
