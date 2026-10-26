pipeline {
    agent any
    stages {
        stage('Checkout') {
            steps { checkout scm }
        }
        stage('Install dependencies') {
            steps { bat 'npm install' }
        }
        stage('Validate JavaScript') {
            steps {
                bat 'node --check server.js'
                bat 'node --check public/app.js'
            }
        }
        stage('Build Docker image') {
            steps { bat 'docker build -t student-attendance:latest .' }
        }
    }
}