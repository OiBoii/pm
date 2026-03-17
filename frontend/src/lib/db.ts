import { Pool } from "pg";
import { initialData, type BoardData } from "./kanban";

const MVP_USERNAME = "user";

const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
});

export async function initDb() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username VARCHAR(255) NOT NULL UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS boards (
        id SERIAL PRIMARY KEY,
        user_id INTEGER NOT NULL UNIQUE,
        board_json TEXT NOT NULL,
        schema_version INTEGER NOT NULL DEFAULT 1,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Ensure the MVP user exists
    await pool.query(
      `INSERT INTO users (username) VALUES ($1) ON CONFLICT (username) DO NOTHING`,
      [MVP_USERNAME]
    );

    // Ensure the board exists for the MVP user
    const userResult = await pool.query(
      `SELECT id FROM users WHERE username = $1`,
      [MVP_USERNAME]
    );
    
    if (userResult.rows.length > 0) {
      const userId = userResult.rows[0].id;
      const boardJson = JSON.stringify(initialData);
      
      await pool.query(
        `INSERT INTO boards (user_id, board_json) VALUES ($1, $2) ON CONFLICT (user_id) DO NOTHING`,
        [userId, boardJson]
      );
    }
  } catch (error) {
    console.error("Failed to initialize database:", error);
    throw error;
  }
}

export async function getBoard(username: string = MVP_USERNAME): Promise<BoardData> {
  await initDb(); // Ensure tables and user exist

  const result = await pool.query(
    `
    SELECT b.board_json 
    FROM boards b
    JOIN users u ON b.user_id = u.id
    WHERE u.username = $1
    `,
    [username]
  );

  if (result.rows.length === 0) {
    return initialData;
  }

  return JSON.parse(result.rows[0].board_json);
}

export async function updateBoard(board: BoardData, username: string = MVP_USERNAME): Promise<BoardData> {
  await initDb(); // Ensure tables and user exist

  const boardJson = JSON.stringify(board);

  const userResult = await pool.query(
    `SELECT id FROM users WHERE username = $1`,
    [username]
  );
  
  if (userResult.rows.length === 0) {
    throw new Error("User not found");
  }
  const userId = userResult.rows[0].id;

  await pool.query(
    `
    INSERT INTO boards (user_id, board_json)
    VALUES ($1, $2)
    ON CONFLICT (user_id) DO UPDATE SET
      board_json = EXCLUDED.board_json,
      updated_at = CURRENT_TIMESTAMP
    `,
    [userId, boardJson]
  );

  return board;
}
