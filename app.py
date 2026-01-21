
import eventlet
# CRITICAL: Monkey patch everything before any other imports
eventlet.monkey_patch()

import serial
import time
import sys
import os
from flask import Flask
from flask_socketio import SocketIO, emit

app = Flask(__name__)
# Ensure the server is ready for high-frequency pulse data
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Global state
keep_running = True
ser = None
btns = {}

def hardware_worker():
    """Main worker for both GPIO buttons and Arduino Serial"""
    global keep_running, ser, btns
    
    print(">>> HARDWARE WORKER: Initializing...", flush=True)
    
    # 1. Initialize GPIO Buttons inside the worker
    try:
        from gpiozero import Button
        # P1: Ja=17, Nein=27 | P2: Ja=22, Nein=23
        # We define them here so they don't block the main thread startup
        btns["p1_ja"] = Button(17)
        btns["p1_ne"] = Button(27)
        btns["p2_ja"] = Button(22)
        btns["p2_ne"] = Button(23)
        
        btns["p1_ja"].when_pressed = lambda: socketio.emit('hardware_input', {'player': 1, 'val': 'Ja'})
        btns["p1_ne"].when_pressed = lambda: socketio.emit('hardware_input', {'player': 1, 'val': 'Nein'})
        btns["p2_ja"].when_pressed = lambda: socketio.emit('hardware_input', {'player': 2, 'val': 'Ja'})
        btns["p2_ne"].when_pressed = lambda: socketio.emit('hardware_input', {'player': 2, 'val': 'Nein'})
        
        print(">>> GPIO: Buttons active", flush=True)
    except Exception as e:
        print(f">>> GPIO Error: {e}", flush=True)

    # 2. Continuous Serial Connection & Read Loop
    last_emit_time = 0
    ports = ['/dev/ttyACM0', '/dev/ttyUSB0', '/dev/ttyACM1', '/dev/ttyUSB1']
    
    while keep_running:
        # Reconnect logic if serial is lost or not yet connected
        if ser is None or not ser.is_open:
            for port in ports:
                try:
                    ser = serial.Serial(port, 9600, timeout=0.05)
                    print(f">>> ARDUINO: Connected on {port}", flush=True)
                    socketio.emit('status', {'msg': f'ARDUINO_OK:{port[-4:]}'})
                    break
                except:
                    continue
            if ser is None:
                # Wait before next retry to avoid CPU hogging
                eventlet.sleep(2.0)
                continue

        # Read logic
        try:
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if "," in line:
                    parts = line.split(",")
                    if len(parts) == 2:
                        curr = time.time()
                        if curr - last_emit_time > 0.08: # ~12Hz updates
                            try:
                                p1 = int(int(parts[0]) / 10) + 45
                                p2 = int(int(parts[1]) / 10) + 45
                                socketio.emit('live_pulse', {'p1': p1, 'p2': p2})
                                last_emit_time = curr
                            except: pass
        except Exception:
            print(">>> ARDUINO: Connection lost", flush=True)
            ser = None
            
        eventlet.sleep(0.01) # Yield to event loop

@socketio.on('connect')
def on_connect():
    print(">>> CLIENT: Connected", flush=True)
    # Send confirmation immediately
    emit('status', {'msg': 'SVR_OK'})

if __name__ == '__main__':
    # Start the hardware background task
    eventlet.spawn(hardware_worker)
    
    print(">>> SYSTEM: Starting Server on port 5000...", flush=True)
    try:
        # Explicitly use eventlet's wsgi server via socketio.run
        socketio.run(app, host='0.0.0.0', port=5000, log_output=False)
    except KeyboardInterrupt:
        print("\n>>> SYSTEM: Shutdown requested", flush=True)
        keep_running = False
        # Clean up GPIO to avoid the lgpio traceback
        try:
            for b in btns.values():
                b.close()
        except: pass
        if ser and ser.is_open:
            ser.close()
        os._exit(0) # Force exit to prevent hanging threads
