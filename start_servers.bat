@echo off
echo Starting QuickDesk Help Desk System...
echo.

echo Activating virtual environment...
call .venv\Scripts\activate.bat

echo.
echo Starting backend server on http://localhost:5000...
start "QuickDesk Backend" cmd /k "cd backend && python app.py"

echo.
echo Waiting for backend to start...
timeout /t 3 /nobreak > nul

echo.
echo Starting frontend server on http://localhost:8000...
start "QuickDesk Frontend" cmd /k "python start_frontend.py"

echo.
echo Both servers are starting...
echo Backend: http://localhost:5000
echo Frontend: http://localhost:8000
echo.
echo Press any key to exit...
pause > nul
