const express = require("express");
const fs = require("fs");
const path = require("path");
const initSqlJs = require("sql.js");

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, "attendance.sqlite");

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let db;
function saveDb() {
  fs.writeFileSync(DB_FILE, Buffer.from(db.export()));
}
function rows(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const result = [];
  while (stmt.step()) result.push(stmt.getAsObject());
  stmt.free();
  return result;
}
function run(sql, params = []) {
  db.run(sql, params);
  saveDb();
}

initSqlJs().then(SQL => {
  const bytes = fs.existsSync(DB_FILE) ? new Uint8Array(fs.readFileSync(DB_FILE)) : undefined;
  db = bytes ? new SQL.Database(bytes) : new SQL.Database();
  db.run(`
    CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      roll_no TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      department TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attendance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_id INTEGER NOT NULL,
      date TEXT NOT NULL,
      period INTEGER NOT NULL CHECK(period BETWEEN 1 AND 7),
      status TEXT NOT NULL CHECK(status IN ('Present','Absent')),
      UNIQUE(student_id, date, period),
      FOREIGN KEY(student_id) REFERENCES students(id)
    );
  `);
  saveDb();

  app.get("/api/students", (req, res) => {
    res.json(rows("SELECT * FROM students ORDER BY roll_no"));
  });

  app.post("/api/students", (req, res) => {
    const { roll_no, name, department } = req.body;
    if (!roll_no?.trim() || !name?.trim() || !department?.trim()) {
      return res.status(400).json({ error: "Roll number, name, and department are required." });
    }
    try {
      db.run("INSERT INTO students (roll_no,name,department) VALUES (?,?,?)",
        [roll_no.trim(), name.trim(), department.trim()]);
      saveDb();
      res.status(201).json({ message: "Student added." });
    } catch {
      res.status(409).json({ error: "That roll number already exists." });
    }
  });

  app.delete("/api/students/:id", (req, res) => {
    const id = Number(req.params.id);
    db.run("DELETE FROM attendance WHERE student_id = ?", [id]);
    db.run("DELETE FROM students WHERE id = ?", [id]);
    saveDb();
    res.json({ message: "Student and their attendance records deleted." });
  });

  app.get("/api/attendance", (req, res) => {
    const date = req.query.date;
    if (!date) return res.status(400).json({ error: "A date is required." });
    res.json(rows(
      `SELECT s.id AS student_id, a.period, a.status
       FROM students s LEFT JOIN attendance a ON a.student_id=s.id AND a.date=?
       ORDER BY s.roll_no, a.period`, [date]
    ));
  });

  app.post("/api/attendance", (req, res) => {
    const { date, records } = req.body;
    if (!date || !Array.isArray(records)) {
      return res.status(400).json({ error: "Date and attendance records are required." });
    }
    db.run("BEGIN TRANSACTION");
    try {
      for (const record of records) {
        const studentId = Number(record.student_id);
        const period = Number(record.period);
        const status = record.status;
        if (!Number.isInteger(studentId) || period < 1 || period > 7 ||
            !["Present", "Absent"].includes(status)) {
          throw new Error("Invalid attendance record.");
        }
        db.run(
          `INSERT INTO attendance (student_id,date,period,status) VALUES (?,?,?,?)
           ON CONFLICT(student_id,date,period) DO UPDATE SET status=excluded.status`,
          [studentId, date, period, status]
        );
      }
      db.run("COMMIT");
      saveDb();
      res.json({ message: "Attendance saved successfully." });
    } catch (error) {
      db.run("ROLLBACK");
      res.status(400).json({ error: error.message || "Could not save attendance." });
    }
  });

  app.get("/api/report", (req, res) => {
    const month = req.query.month; // YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(month || "")) {
      return res.status(400).json({ error: "Choose a month in YYYY-MM format." });
    }
    const data = rows(
      `SELECT s.id, s.roll_no, s.name, s.department,
        SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END) AS attended,
        SUM(CASE WHEN a.status='Absent' THEN 1 ELSE 0 END) AS absent,
        COUNT(a.id) AS marked
       FROM students s
       LEFT JOIN attendance a ON a.student_id=s.id AND substr(a.date,1,7)=?
       GROUP BY s.id ORDER BY s.roll_no`, [month]
    ).map(s => ({
      ...s,
      attended: Number(s.attended || 0),
      absent: Number(s.absent || 0),
      working_periods: Number(s.marked || 0),
      percentage: Number(s.marked) ? Math.round((Number(s.attended) / Number(s.marked)) * 10000) / 100 : 0
    }));
    res.json(data);
  });

  app.get("/api/report.csv", (req, res) => {
    const month = req.query.month;
    if (!/^\d{4}-\d{2}$/.test(month || "")) {
      return res.status(400).send("Choose a month in YYYY-MM format.");
    }
    const data = rows(
      `SELECT s.roll_no, s.name, s.department,
        SUM(CASE WHEN a.status='Present' THEN 1 ELSE 0 END) AS attended,
        SUM(CASE WHEN a.status='Absent' THEN 1 ELSE 0 END) AS absent,
        COUNT(a.id) AS working_periods
       FROM students s LEFT JOIN attendance a
       ON a.student_id=s.id AND substr(a.date,1,7)=?
       GROUP BY s.id ORDER BY s.roll_no`, [month]
    );
    const csv = [
      "Roll Number,Name,Department,Periods Attended,Periods Absent,Marked Periods,Attendance Percentage",
      ...data.map(s => {
        const marked = Number(s.working_periods || 0);
        const attended = Number(s.attended || 0);
        const pct = marked ? ((attended / marked) * 100).toFixed(2) : "0.00";
        const safe = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
        return [safe(s.roll_no), safe(s.name), safe(s.department), attended,
          Number(s.absent || 0), marked, pct].join(",");
      })
    ].join("\n");
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="attendance-${month}.csv"`);
    res.send(csv);
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Attendance app running at http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error("Could not initialize SQLite database:", err);
  process.exit(1);
});
