
import serial
import time
import threading
import eventlet
from flask import Flask
from flask_socketio import SocketIO, emit

# Eventlet monkey patching is required for SocketIO with Flask
eventlet.monkey_patch()

app = Flask(__name__)
# Enable CORS for local development (Port 5173 for Vite)
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# --- Hardware Setup ---
try:
    from gpiozero import Button
    # P1: Ja=17, Nein=27 | P2: Ja=22, Nein=23
    btns = {
        "p1_ja": Button(17),
        "p1_ne": Button(27),
        "p2_ja": Button(22),
        "p2_ne": Button(23)
    }
    
    def setup_callbacks():
        btns["p1_ja"].when_pressed = lambda: socketio.emit('hardware_input', {'player': 1, 'val': 'Ja'})
        btns["p1_ne"].when_pressed = lambda: socketio.emit('hardware_input', {'player': 1, 'val': 'Nein'})
        btns["p2_ja"].when_pressed = lambda: socketio.emit('hardware_input', {'player': 2, 'val': 'Ja'})
        btns["p2_ne"].when_pressed = lambda: socketio.emit('hardware_input', {'player': 2, 'val': 'Nein'})
    
    setup_callbacks()
    print(">>> GPIO Buttons: OK")
except Exception as e:
    print(f">>> GPIO Error: {e} (Simulation mode active)")

# --- Serial / Arduino ---
ser = None
def init_serial():
    global ser
    ports = ['/dev/ttyACM0', '/dev/ttyUSB0', '/dev/ttyACM1']
    for port in ports:
        try:
            ser = serial.Serial(port, 9600, timeout=0.1)
            print(f">>> Arduino connected on {port}")
            return True
        except:
            continue
    print(">>> Arduino NOT found (Simulation mode active)")
    return False

def arduino_worker():
    while True:
        if ser and ser.in_waiting > 0:
            try:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if "," in line:
                    parts = line.split(",")
                    if len(parts) == 2:
                        # Convert raw analog (0-1023) to pseudo BPM
                        # Just a mapping for demonstration
                        p1 = int(int(parts[0]) / 10) + 45
                        p2 = int(int(parts[1]) / 10) + 45
                        socketio.emit('live_pulse', {'p1': p1, 'p2': p2})
            except Exception as e:
                pass
        eventlet.sleep(0.05)

if init_serial():
    threading.Thread(target=arduino_worker, daemon=True).start()

@socketio.on('connect')
def on_connect():
    print('Web client connected to hardware server')
    emit('status', {'msg': 'Hardware Interface Active'})

if __name__ == '__main__':
    print(">>> HARDWARE BACKEND STARTING ON http://0.0.0.0:5000")
    # Using eventlet as the WSGI server
    socketio.run(app, host='0.0.0.0', port=5000)
