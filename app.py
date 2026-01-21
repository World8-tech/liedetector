
import eventlet
eventlet.monkey_patch()

import serial
import os
from flask import Flask
from flask_socketio import SocketIO, emit

app = Flask(__name__)
# eventlet ist zwingend erforderlich für stabile Performance auf dem Pi
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='eventlet')

# Globaler Status
ser = None
state = {"p1_bpm": 0, "p2_bpm": 0}

def hardware_loop():
    """Hintergrund-Task: Liest Hardware aus und sendet Events"""
    global ser
    print(">>> HW_TASK: Gestartet", flush=True)
    
    # GPIO Setup
    try:
        from gpiozero import Button
        b1_ja = Button(17); b1_ne = Button(27)
        b2_ja = Button(22); b2_ne = Button(23)
        
        b1_ja.when_pressed = lambda: socketio.emit('hardware_input', {'player': 1, 'val': 'Ja'})
        b1_ne.when_pressed = lambda: socketio.emit('hardware_input', {'player': 1, 'val': 'Nein'})
        b2_ja.when_pressed = lambda: socketio.emit('hardware_input', {'player': 2, 'val': 'Ja'})
        b2_ne.when_pressed = lambda: socketio.emit('hardware_input', {'player': 2, 'val': 'Nein'})
        print(">>> BUTTONS: Aktiv", flush=True)
    except:
        print(">>> BUTTONS: Nicht verfügbar", flush=True)

    ports = ['/dev/ttyACM0', '/dev/ttyUSB0', '/dev/ttyACM1']
    last_emit = 0
    
    while True:
        # Verbindung zum Arduino sicherstellen
        if ser is None or not ser.is_open:
            for p in ports:
                try:
                    # Kurzer Timeout ist wichtig, damit die Loop nicht blockiert
                    ser = serial.Serial(p, 9600, timeout=0.05)
                    print(f">>> ARDUINO: Verbunden auf {p}", flush=True)
                    socketio.emit('status', {'msg': f'ARDUINO_OK'})
                    break
                except:
                    continue
            socketio.sleep(1.0)
            continue

        try:
            # Prüfen ob Daten da sind (nicht blockierend)
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if "," in line:
                    parts = line.split(",")
                    if len(parts) == 2:
                        try:
                            v1, v2 = int(parts[0]), int(parts[1])
                            state["p1_bpm"] = int(v1 / 10) + 45
                            state["p2_bpm"] = int(v2 / 10) + 45
                            
                            # Sende Rate begrenzen um CPU zu schonen
                            import time
                            now = time.time()
                            if now - last_emit > 0.1: 
                                socketio.emit('live_pulse', {'p1': state["p1_bpm"], 'p2': state["p2_bpm"]})
                                last_emit = now
                        except:
                            pass
        except Exception as e:
            print(f">>> ARDUINO: Fehler {e}", flush=True)
            ser = None
        
        # WICHTIG: socketio.sleep statt time.sleep verwenden!
        # Dies erlaubt eventlet den Kontextwechsel zum Senden der Daten.
        socketio.sleep(0.01)

@socketio.on('connect')
def handle_connect():
    print(">>> CLIENT: Verbunden", flush=True)
    emit('status', {'msg': 'LINK_OK'})

if __name__ == '__main__':
    # Hintergrund-Task über SocketIO starten
    socketio.start_background_task(hardware_loop)
    
    print(">>> SERVER: Start auf http://0.0.0.0:5000", flush=True)
    try:
        socketio.run(app, host='0.0.0.0', port=5000, log_output=False)
    except KeyboardInterrupt:
        print(">>> SERVER: Stopp", flush=True)
        os._exit(0)
