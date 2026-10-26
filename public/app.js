const $ = id => document.getElementById(id);
const today = new Date();
const localDate = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
$("attendance-date").value = localDate;
$("report-month").value = localDate.slice(0,7);

let students = [];
let attendance = new Map();

function message(id, text, isError = false) {
  $(id).textContent = text;
  $(id).classList.toggle("error", isError);
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json" },
    ...options
  });
  const data = response.headers.get("content-type")?.includes("application/json")
    ? await response.json() : await response.text();
  if (!response.ok) throw new Error(data.error || data || "Request failed");
  return data;
}
async function loadStudents() {
  students = await api("/api/students");
  await loadDay();
}
async function loadDay() {
  const date = $("attendance-date").value;
  if (!date) return;
  const saved = await api(`/api/attendance?date=${encodeURIComponent(date)}`);
  attendance = new Map();
  saved.forEach(record => {
    if (record.period && record.status) {
      attendance.set(`${record.student_id}-${record.period}`, record.status);
    }
  });
  renderAttendance();
}
function renderAttendance() {
  const body = $("attendance-body");
  body.innerHTML = "";
  if (!students.length) {
    body.innerHTML = '<tr><td colspan="10" class="empty">Add a student to begin.</td></tr>';
    return;
  }
  for (const student of students) {
    const tr = document.createElement("tr");
    const info = [student.roll_no, student.name, student.department];
    info.forEach(value => {
      const td = document.createElement("td");
      td.textContent = value;
      tr.appendChild(td);
    });
    for (let period = 1; period <= 7; period++) {
      const td = document.createElement("td");
      const select = document.createElement("select");
      select.className = "status-select";
      select.setAttribute("aria-label", `${student.name}, period ${period}`);
      select.dataset.studentId = student.id;
      select.dataset.period = period;
      [["", "Not marked"], ["Present", "Present"], ["Absent", "Absent"]].forEach(([value, label]) => {
        const option = document.createElement("option");
        option.value = value; option.textContent = label;
        select.appendChild(option);
      });
      select.value = attendance.get(`${student.id}-${period}`) || "";
      select.addEventListener("change", () => {
        const key = `${student.id}-${period}`;
        if (select.value) attendance.set(key, select.value);
        else attendance.delete(key);
      });
      td.appendChild(select);
      tr.appendChild(td);
    }
    body.appendChild(tr);
  }
}
function markAll(status) {
  document.querySelectorAll(".status-select").forEach(select => {
    select.value = status;
    attendance.set(`${select.dataset.studentId}-${select.dataset.period}`, status);
  });
}
$("student-form").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    await api("/api/students", { method:"POST", body:JSON.stringify({
      roll_no:$("roll-no").value, name:$("student-name").value, department:$("department").value
    })});
    $("student-form").reset();
    message("student-message", "Student added successfully.");
    await loadStudents();
  } catch (error) { message("student-message", error.message, true); }
});
$("attendance-date").addEventListener("change", () => loadDay().catch(e => message("attendance-message", e.message, true)));
$("all-present").addEventListener("click", () => markAll("Present"));
$("all-absent").addEventListener("click", () => markAll("Absent"));
$("save-attendance").addEventListener("click", async () => {
  const records = [...attendance.entries()].map(([key,status]) => {
    const [student_id, period] = key.split("-");
    return {student_id:Number(student_id), period:Number(period), status};
  });
  try {
    await api("/api/attendance", {method:"POST", body:JSON.stringify({date:$("attendance-date").value, records})});
    message("attendance-message", "Attendance saved successfully.");
  } catch (error) { message("attendance-message", error.message, true); }
});
$("load-report").addEventListener("click", async () => {
  try {
    const report = await api(`/api/report?month=${encodeURIComponent($("report-month").value)}`);
    const body = $("report-body"); body.innerHTML = "";
    if (!report.length) { body.innerHTML = '<tr><td colspan="7" class="empty">No students found.</td></tr>'; return; }
    report.forEach(s => {
      const tr = document.createElement("tr");
      const values = [s.roll_no, s.name, s.attended, s.absent, s.working_periods, `${s.percentage.toFixed(2)}%`,
        s.working_periods && s.percentage < 75 ? "Below 75%" : (s.working_periods ? "On track" : "Not marked")];
      values.forEach((value, index) => {
        const td = document.createElement("td"); td.textContent = value;
        if (index === 6 && value === "Below 75%") td.style.color = "#b42318";
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
  } catch (error) { alert(error.message); }
});
$("export-report").addEventListener("click", () => {
  if (!$("report-month").value) return alert("Choose a month first.");
  window.location.href = `/api/report.csv?month=${encodeURIComponent($("report-month").value)}`;
});
loadStudents().catch(error => message("student-message", error.message, true));
