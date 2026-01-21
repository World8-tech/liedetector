
import serial
import time
import eventlet
import sys
from flask import Flask
from flask_socketio import SocketIO, emit

# Eventlet monkey patching MUST happen before other imports
eventlet.monkey_patch()

app = Flask(__name__)
# Standard SocketIO setup with eventlet
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Global flag for clean shutdown
keep_running = True
ser = None

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
        # Use socketio.emit directly in callbacks
        btns["p1_ja"].when_pressed = lambda: socketio.emit('hardware_input', {'player': 1, 'val': 'Ja'})
        btns["p1_ne"].when_pressed = lambda: socketio.emit('hardware_input', {'player': 1, 'val': 'Nein'})
        btns["p2_ja"].when_pressed = lambda: socketio.emit('hardware_input', {'player': 2, 'val': 'Ja'})
        btns["p2_ne"].when_pressed = lambda: socketio.emit('hardware_input', {'player': 2, 'val': 'Nein'})
    
    setup_callbacks()
    print(">>> GPIO Buttons: OK", flush=True)
except Exception as e:
    print(f">>> GPIO Error: {e} (Simulation mode active)", flush=True)

# --- Serial / Arduino ---
def init_serial():
    global ser
    ports = ['/dev/ttyACM0', '/dev/ttyUSB0', '/dev/ttyACM1']
    for port in ports:
        try:
            # We use a non-blocking or short timeout read
            ser = serial.Serial(port, 9600, timeout=0.1)
            print(f">>> Arduino connected on {port}", flush=True)
            return True
        except:
            continue
    print(">>> Arduino NOT found (Simulation mode active)", flush=True)
    return False

def arduino_worker():
    """Background worker using eventlet cooperative yielding"""
    global keep_running, ser
    print(">>> Arduino Worker Started", flush=True)
    last_emit_time = 0
    
    while keep_running:
        try:
            if ser and ser.is_open and ser.in_waiting > 0:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if "," in line:
                    parts = line.split(",")
                    if len(parts) == 2:
                        current_time = time.time()
                        # Throttling to 10Hz to prevent flooding the network
                        if current_time - last_emit_time > 0.1:
                            try:
                                p1 = int(int(parts[0]) / 10) + 45
                                p2 = int(int(parts[1]) / 10) + 45
                                socketio.emit('live_pulse', {'p1': p1, 'p2': p2})
                                last_emit_time = current_time
                            except (ValueError, IndexError):
                                pass
        except Exception as e:
            # If serial fails, we don't want to crash the whole loop
            eventlet.sleep(1) 
            
        # CRITICAL: This allows other tasks (like sending WebSocket packets) to run
        eventlet.sleep(0.01)

@socketio.on('connect')
def on_connect():
    print(">>> Client connected", flush=True)
    emit('status', {'msg': 'Hardware Interface Active'})

if __name__ == '__main__':
    # Initialize serial before starting the server
    init_serial()
    
    # Start the worker using eventlet.spawn instead of threading.Thread
    # This integrates the worker directly into the eventlet hub
    eventlet.spawn(arduino_worker)
    
    print(">>> HARDWARE BACKEND STARTING ON http://0.0.0.0:5000", flush=True)
    try:
        # socketio.run internally uses eventlet.wsgi.server when async_mode is eventlet
        socketio.run(app, host='0.0.0.0', port=5000, log_output=False)
    except KeyboardInterrupt:
        print("\n>>> SHUTTING DOWN...", flush=True)
        keep_running = False
        if ser and ser.is_open:
            ser.close()
        sys.exit(0)
