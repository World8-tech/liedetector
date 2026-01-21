
import serial
import time
import threading
import eventlet
from flask import Flask, render_template
from flask_socketio import SocketIO, emit

# Eventlet monkey patching for async performance
eventlet.monkey_patch()

app = Flask(__name__)
socketio = SocketIO(app, cors_allowed_origins="*")

# State tracking for the Python side
state = {
    "p1_bpm": 0,
    "p2_bpm": 0,
}

# --- Hardware Setup ---
# Attempt to initialize GPIO for Raspberry Pi Buttons
try:
    from gpiozero import Button
    # GPIO Pins: 17=P1_JA, 27=P1_NEIN, 22=P2_JA, 23=P2_NEIN
    btn_p1_ja = Button(17)
    btn_p1_nein = Button(27)
    btn_p2_ja = Button(22)
    btn_p2_nein = Button(23)
    
    def setup_hardware_callbacks():
        btn_p1_ja.when_pressed = lambda: socketio.emit('hardware_input', {'player': 1, 'val': 'Ja'})
        btn_p1_nein.when_pressed = lambda: socketio.emit('hardware_input', {'player': 1, 'val': 'Nein'})
        btn_p2_ja.when_pressed = lambda: socketio.emit('hardware_input', {'player': 2, 'val': 'Ja'})
        btn_p2_nein.when_pressed = lambda: socketio.emit('hardware_input', {'player': 2, 'val': 'Nein'})
    
    setup_hardware_callbacks()
    print("GPIO Buttons initialized successfully.")
except Exception as e:
    print(f"GPIO Error: {e}. Running in simulation mode for buttons.")

# Attempt to initialize Serial for Arduino
ser = None
try:
    # Common ports: /dev/ttyACM0 or /dev/ttyUSB0
    ser = serial.Serial('/dev/ttyACM0', 9600, timeout=0.1)
    print("Arduino connected on /dev/ttyACM0")
except:
    try:
        ser = serial.Serial('/dev/ttyUSB0', 9600, timeout=0.1)
        print("Arduino connected on /dev/ttyUSB0")
    except:
        print("Arduino not found. Running in simulation mode for pulse.")

def read_arduino_thread():
    global ser
    while True:
        if ser and ser.in_waiting > 0:
            try:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if "," in line:
                    parts = line.split(",")
                    if len(parts) == 2:
                        v1 = int(parts[0])
                        v2 = int(parts[1])
                        # Rough conversion from raw analog to pseudo BPM
                        p1_bpm = int(v1 / 10) + 45
                        p2_bpm = int(v2 / 10) + 45
                        socketio.emit('live_pulse', {'p1': p1_bpm, 'p2': p2_bpm})
            except:
                pass
        time.sleep(0.05)

if ser:
    threading.Thread(target=read_arduino_thread, daemon=True).start()

@socketio.on('connect')
def handle_connect():
    print('Web client connected')
    emit('status', {'msg': 'Connected to Pi Backend'})

if __name__ == '__main__':
    # In a real Pi environment, you'd serve the built React files or use a proxy
    print("Starting Lie Detector Server on port 5000...")
    socketio.run(app, host='0.0.0.0', port=5000)
