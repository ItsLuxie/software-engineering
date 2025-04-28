
import React, { useState, useEffect, createContext, useContext } from "https://esm.sh/react@18.2.0";
import { createRoot } from "https://esm.sh/react-dom@18.2.0/client";

// Authentication Context
const AuthContext = createContext(null);

// Types
interface User {
  id: number;
  username: string;
  role: 'admin' | 'doctor' | 'staff';
}

interface HealthProgram {
  id?: number;
  name: string;
  description: string;
}

interface Client {
  id?: number;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  contactNumber: string;
  email?: string;
  programs?: HealthProgram[];
}

// Navigation Component
function Navigation() {
  const auth = useContext(AuthContext);

  if (!auth?.user) return null;

  return (
    <nav className="main-navigation">
      <div className="logo">🏥 HealthTrack</div>
      <ul>
        <li><a href="/dashboard">Dashboard</a></li>
        {auth.user.role !== 'staff' && (
          <>
            <li><a href="/clients">Clients</a></li>
            <li><a href="/programs">Programs</a></li>
          </>
        )}
        <li><a href="/profile">Profile</a></li>
        <li><a href="/logout" onClick={auth.logout}>Logout</a></li>
      </ul>
    </nav>
  );
}

// Login Component
function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const auth = useContext(AuthContext);

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();
      if (data.success) {
        auth.login(data.user);
      } else {
        setError(data.message || 'Login failed');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    }
  };

  return (
    <div className="login-container">
      <form onSubmit={handleLogin} className="login-form">
        <h2>HealthTrack Login</h2>
        {error && <div className="error-message">{error}</div>}
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button type="submit">Login</button>
      </form>
    </div>
  );
}

// Dashboard Component
function Dashboard() {
  const auth = useContext(AuthContext);
  const [stats, setStats] = useState({
    totalClients: 0,
    totalPrograms: 0,
    recentEnrollments: []
  });

  useEffect(() => {
    const fetchStats = async () => {
      const response = await fetch('/dashboard-stats');
      const data = await response.json();
      setStats(data);
    };
    fetchStats();
  }, []);

  return (
    <div className="dashboard">
      <h1>Welcome, {auth.user.username}</h1>
      <div className="dashboard-grid">
        <div className="dashboard-card">
          <h3>Total Clients</h3>
          <p className="big-number">{stats.totalClients}</p>
        </div>
        <div className="dashboard-card">
          <h3>Health Programs</h3>
          <p className="big-number">{stats.totalPrograms}</p>
        </div>
        <div className="dashboard-card full-width">
          <h3>Recent Enrollments</h3>
          {stats.recentEnrollments.map((enrollment) => (
            <div key={enrollment.id} className="enrollment-item">
              {enrollment.clientName} - {enrollment.programName}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Main App Component with Authentication
function App() {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const response = await fetch('/check-auth');
        const data = await response.json();
        if (data.authenticated) {
          setUser(data.user);
        }
      } catch (error) {
        console.error('Authentication check failed');
      }
      setIsLoading(false);
    };
    checkAuth();
  }, []);

  const login = (userData) => {
    setUser(userData);
  };

  const logout = async () => {
    await fetch('/logout', { method: 'POST' });
    setUser(null);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <div className="app-container">
        {!user ? (
          <Login />
        ) : (
          <>
            <Navigation />
            <main>
              <Dashboard />
            </main>
          </>
        )}
      </div>
    </AuthContext.Provider>
  );
}

function client() {
  createRoot(document.getElementById("root")).render(<App />);
}
if (typeof document !== "undefined") { client(); }

export default async function server(request: Request): Promise<Response> {
  const { sqlite } = await import("https://esm.town/v/stevekrouse/sqlite");
  const KEY = new URL(import.meta.url).pathname.split("/").at(-1);
  const SCHEMA_VERSION = 2;

  // User table
  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS ${KEY}_users_${SCHEMA_VERSION} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL
    )
  `);

  // Existing tables from previous implementation
  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS ${KEY}_health_programs_${SCHEMA_VERSION} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT
    )
  `);

  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS ${KEY}_clients_${SCHEMA_VERSION} (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      date_of_birth DATE NOT NULL,
      contact_number TEXT NOT NULL,
      email TEXT
    )
  `);

  await sqlite.execute(`
    CREATE TABLE IF NOT EXISTS ${KEY}_client_programs_${SCHEMA_VERSION} (
      client_id INTEGER,
      program_id INTEGER,
      enrollment_date DATE DEFAULT CURRENT_DATE,
      PRIMARY KEY (client_id, program_id),
      FOREIGN KEY (client_id) REFERENCES ${KEY}_clients_${SCHEMA_VERSION}(id),
      FOREIGN KEY (program_id) REFERENCES ${KEY}_health_programs_${SCHEMA_VERSION}(id)
    )
  `);

  // Authentication Endpoints
  if (request.method === "POST" && new URL(request.url).pathname === "/login") {
    const { username, password } = await request.json();
    
    const result = await sqlite.execute(
      `SELECT * FROM ${KEY}_users_${SCHEMA_VERSION} 
       WHERE username = ? AND password = ?`,
      [username, password]  // Note: In production, use proper password hashing!
    );

    if (result.rows.length > 0) {
      const user = result.rows[0];
      return new Response(JSON.stringify({ 
        success: true, 
        user: { 
          id: user.id, 
          username: user.username, 
          role: user.role 
        } 
      }), { 
        headers: { 
          "Content-Type": "application/json",
          "Set-Cookie": `session=${user.id}; HttpOnly; Path=/; SameSite=Strict`
        } 
      });
    }

    return new Response(JSON.stringify({ 
      success: false, 
      message: "Invalid credentials" 
    }), { status: 401 });
  }

  // Check Authentication
  if (request.method === "GET" && new URL(request.url).pathname === "/check-auth") {
    const cookie = request.headers.get('cookie');
    const sessionMatch = cookie?.match(/session=(\d+)/);
    
    if (sessionMatch) {
      const userId = sessionMatch[1];
      const result = await sqlite.execute(
        `SELECT id, username, role FROM ${KEY}_users_${SCHEMA_VERSION} WHERE id = ?`,
        [userId]
      );

      if (result.rows.length > 0) {
        return new Response(JSON.stringify({ 
          authenticated: true, 
          user: result.rows[0] 
        }));
      }
    }

    return new Response(JSON.stringify({ authenticated: false }));
  }

  // Logout
  if (request.method === "POST" && new URL(request.url).pathname === "/logout") {
    return new Response(JSON.stringify({ success: true }), {
      headers: {
        "Set-Cookie": "session=; HttpOnly; Path=/; Max-Age=0; SameSite=Strict"
      }
    });
  }

  // Dashboard Stats
  if (request.method === "GET" && new URL(request.url).pathname === "/dashboard-stats") {
    const totalClients = await sqlite.execute(
      `SELECT COUNT(*) as count FROM ${KEY}_clients_${SCHEMA_VERSION}`
    );

    const totalPrograms = await sqlite.execute(
      `SELECT COUNT(*) as count FROM ${KEY}_health_programs_${SCHEMA_VERSION}`
    );

    const recentEnrollments = await sqlite.execute(`
      SELECT 
        cp.enrollment_date, 
        c.first_name || ' ' || c.last_name as clientName, 
        hp.name as programName 
      FROM ${KEY}_client_programs_${SCHEMA_VERSION} cp
      JOIN ${KEY}_clients_${SCHEMA_VERSION} c ON cp.client_id = c.id
      JOIN ${KEY}_health_programs_${SCHEMA_VERSION} hp ON cp.program_id = hp.id
      ORDER BY cp.enrollment_date DESC
      LIMIT 5
    `);

    return new Response(JSON.stringify({
      totalClients: totalClients.rows[0].count,
      totalPrograms: totalPrograms.rows[0].count,
      recentEnrollments: recentEnrollments.rows
    }));
  }

  // Render main page
  return new Response(`
    <html>
      <head>
        <title>HealthTrack</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>${css}</style>
      </head>
      <body>
        <div id="root"></div>
        <script src="https://esm.town/v/std/catch"></script>
        <script type="module" src="${import.meta.url}"></script>
      </body>
    </html>
  `, {
    headers: { "Content-Type": "text/html" }
  });
}

const css = `
:root {
  --primary-color: #2c3e50;
  --secondary-color: #3498db;
  --background-light: #ecf0f1;
  --text-color: #333;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
  line-height: 1.6;
  color: var(--text-color);
  background-color: var(--background-light);
}

.app-container {
  max-width: 1200px;
  margin: 0 auto;
}

.main-navigation {
  background-color: var(--primary-color);
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
}

.main-navigation .logo {
  font-size: 1.5rem;
  font-weight: bold;
}

.main-navigation ul {
  display: flex;
  list-style: none;
}

.main-navigation ul li {
  margin-left: 1rem;
}

.main-navigation ul li a {
  color: white;
  text-decoration: none;
  transition: color 0.3s ease;
}

.main-navigation ul li a:hover {
  color: var(--secondary-color);
}

.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: var(--background-light);
}

.login-form {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0,0,0,0.1);
  width: 100%;
  max-width: 400px;
}

.login-form h2 {
  text-align: center;
  margin-bottom: 1.5rem;
  color: var(--primary-color);
}

.login-form input {
  width: 100%;
  padding: 0.75rem;
  margin-bottom: 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.login-form button {
  width: 100%;
  padding: 0.75rem;
  background-color: var(--secondary-color);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  transition: background-color 0.3s ease;
}

.login-form button:hover {
  background-color: #2980b9;
}

.error-message {
  background-color: #e74c3c;
  color: white;
  padding: 0.5rem;
  border-radius: 4px;
  margin-bottom: 1rem;
  text-align: center;
}

.dashboard {
  padding: 2rem;
}

.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1rem;
}

.dashboard-card {
  background: white;
  border-radius: 8px;
  padding: 1.5rem;
  box-shadow: 0 2px 5px rgba(0,0,0,0.1);
}

.dashboard-card.full-width {
  grid-column: span 2;
}

.big-number {
  font-size: 2.5rem;
  font-weight: bold;
  color: var(--secondary-color);
  text-align: center;
}

.enrollment-item {
  padding: 0.5rem;
  border-bottom: 1px solid #eee;
}

.enrollment-item:last-child {
  border-bottom: none;
}
`;
