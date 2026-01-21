
import eventlet
eventlet.monkey_patch() # Wichtig für die Stabilität von SocketIO Threads

import serial
import time
import os
import threading
from flask import Flask
from flask_socketio import SocketIO, emit

app = Flask(__name__)
# eventlet ist der stabilste Modus für den Raspberry Pi
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

keep_running = True
ser = None
state = {"p1_bpm": 0, "p2_bpm": 0}

try:
    from gpiozero import Button
    print(">>> GPIO: OK", flush=True)
except:
    print(">>> GPIO: Error (Simulation Mode)", flush=True)

def hardware_worker():
    global keep_running, ser
    
    # 1. GPIO Setup
    try:
        # P1: 17,27 | P2: 22,23
        b1_ja = Button(17); b1_ne = Button(27)
        b2_ja = Button(22); b2_ne = Button(23)
        
        b1_ja.when_pressed = lambda: socketio.emit('hardware_input', {'player': 1, 'val': 'Ja'})
        b1_ne.when_pressed = lambda: socketio.emit('hardware_input', {'player': 1, 'val': 'Nein'})
        b2_ja.when_pressed = lambda: socketio.emit('hardware_input', {'player': 2, 'val': 'Ja'})
        b2_ne.when_pressed = lambda: socketio.emit('hardware_input', {'player': 2, 'val': 'Nein'})
        print(">>> BUTTONS: OK", flush=True)
    except: pass

    # 2. Arduino Loop
    ports = ['/dev/ttyACM0', '/dev/ttyUSB0', '/dev/ttyACM1']
    last_emit = 0
    
    while keep_running:
        if ser is None or not ser.is_open:
            for p in ports:
                try:
                    ser = serial.Serial(p, 9600, timeout=0.1)
                    socketio.emit('status', {'msg': f'ARDUINO:{p[-4:]}'})
                    break
                except: continue
            time.sleep(1)
            continue

        try:
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if "," in line:
                    parts = line.split(",")
                    if len(parts) == 2:
                        now = time.time()
                        if now - last_emit > 0.1: # Max 10Hz für geringe CPU Last
                            v1, v2 = int(parts[0]), int(parts[1])
                            state["p1_bpm"] = int(v1 / 10) + 45
                            state["p2_bpm"] = int(v2 / 10) + 45
                            socketio.emit('live_pulse', {'p1': state["p1_bpm"], 'p2': state["p2_bpm"]})
                            last_emit = now
        except:
            ser = None
        time.sleep(0.01)

@socketio.on('connect')
def connect():
    emit('status', {'msg': 'LINK_OK'})

if __name__ == '__main__':
    threading.Thread(target=hardware_worker, daemon=True).start()
    print(">>> SERVER: Start auf http://0.0.0.0:5000", flush=True)
    try:
        # allow_unsafe_werkzeug ist bei eventlet nicht mehr nötig
        socketio.run(app, host='0.0.0.0', port=5000, log_output=False)
    except KeyboardInterrupt:
        os._exit(0)
