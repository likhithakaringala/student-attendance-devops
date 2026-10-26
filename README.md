# Student Attendance Management System

A starter implementation of the project described in the proposal.

## Features included
- Add students (roll number, name, department)
- Mark Present/Absent for periods 1–7
- Mark all present or all absent
- Save and reload attendance by date
- Prevent duplicate student/date/period records by updating existing records
- Monthly attended/absent/marked-period totals and percentage
- Identify attendance below 75%
- Export monthly report to CSV
- SQLite database stored in `attendance.sqlite`

## Run locally (Windows + VS Code)
1. Install Node.js LTS and Git.
2. Extract the project ZIP and open this folder in VS Code.
3. Open Terminal > New Terminal.
4. Run:
   ```bash
   npm install
   npm start
   ```
5. Open `http://localhost:3000`.

The SQLite file is created automatically when the server starts. Keep `attendance.sqlite` backed up; do not commit real student data to GitHub.

## Docker
Build and run:
```bash
docker build -t student-attendance:latest .
docker run --name attendance-app -p 3000:3000 -v attendance-data:/app attendance-app
```
Open `http://localhost:3000`.

## Kubernetes (local cluster)
Make sure Docker Desktop Kubernetes or Minikube is running. Build the image in the same image environment used by your cluster, then:
```bash
kubectl apply -f k8s-deployment.yaml
kubectl get pods
kubectl get services
```
Open `http://localhost:30080` when using a local cluster that exposes NodePort on localhost. With Minikube, `minikube service student-attendance-service` may be needed.

**Persistence note:** for a real Kubernetes deployment, configure a PersistentVolumeClaim for the SQLite database or use a managed database. This sample manifest does not configure persistent storage.

## Jenkins
The included Jenkinsfile uses Windows `bat` commands and assumes the Jenkins agent has Node.js, npm, and Docker installed and available on PATH. Connect your GitHub repository to a Jenkins Pipeline job and point it to this Jenkinsfile. If Jenkins runs on Linux, replace `bat` with `sh`.

## Selenium
Create a separate Selenium test project after the app works. Suggested tests:
1. Add a student.
2. Mark seven periods and save.
3. Reload the same date and verify saved statuses.
4. Change one period and save again to verify duplicate entries are updated.
5. Calculate a monthly report and verify the percentage.
6. Export the CSV.

## Important scope notes
- This is a learning starter, not a production-ready system. It has no login/role permissions yet.
- Percentage is based on periods marked Present or Absent; unmarked periods are not counted.
- The 75% threshold is a demo value and should be configurable for your institution.
- Add authentication, authorization, validation, database backups and privacy controls before real use.
