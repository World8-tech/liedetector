
import serial
import time
import sys
import os
import threading
from flask import Flask
from flask_socketio import SocketIO, emit

# Flask & SocketIO Setup
app = Flask(__name__)
# 'threading' ist auf dem Raspberry Pi am stabilsten für GPIO-Interaktionen
socketio = SocketIO(app, cors_allowed_origins="*", async_mode='threading')

# Globaler Status
keep_running = True
ser = None
btns = {}
state = {"p1_bpm": 0, "p2_bpm": 0}

# --- Hardware Initialisierung ---
try:
    from gpiozero import Button
    print(">>> GPIO: Bibliothek geladen", flush=True)
except Exception as e:
    print(f">>> GPIO Fehler: {e}", flush=True)

def hardware_worker():
    """Hintergrund-Thread für GPIO-Buttons und Arduino-Serial"""
    global keep_running, ser, btns
    
    print(">>> HW_WORKER: Initialisiere GPIO...", flush=True)
    
    # 1. GPIO Buttons (P1: 17,27 | P2: 22,23)
    try:
        btns["p1_ja"] = Button(17)
        btns["p1_ne"] = Button(27)
        btns["p2_ja"] = Button(22)
        btns["p2_ne"] = Button(23)
        
        # Events an die Web-App weiterleiten
        btns["p1_ja"].when_pressed = lambda: socketio.emit('hardware_input', {'player': 1, 'val': 'Ja'})
        btns["p1_ne"].when_pressed = lambda: socketio.emit('hardware_input', {'player': 1, 'val': 'Nein'})
        btns["p2_ja"].when_pressed = lambda: socketio.emit('hardware_input', {'player': 2, 'val': 'Ja'})
        btns["p2_ne"].when_pressed = lambda: socketio.emit('hardware_input', {'player': 2, 'val': 'Nein'})
        
        print(">>> GPIO: Buttons aktiv (Pins 17,27,22,23)", flush=True)
    except Exception as e:
        print(f">>> GPIO Setup Fehler: {e}", flush=True)

    # 2. Arduino Serial Loop (Liest "Wert1,Wert2")
    print(">>> HW_WORKER: Suche Arduino...", flush=True)
    last_emit_time = 0
    ports = ['/dev/ttyACM0', '/dev/ttyUSB0', '/dev/ttyACM1', '/dev/ttyUSB1']
    
    while keep_running:
        # Verbindung prüfen/herstellen
        if ser is None or not ser.is_open:
            for port in ports:
                try:
                    ser = serial.Serial(port, 9600, timeout=0.1)
                    print(f">>> ARDUINO: Verbunden auf {port}", flush=True)
                    socketio.emit('status', {'msg': f'ARDUINO_OK:{port[-4:]}'})
                    break
                except:
                    continue
            if ser is None:
                time.sleep(2.0)
                continue

        # Daten lesen
        try:
            if ser.in_waiting > 0:
                line = ser.readline().decode('utf-8', errors='ignore').strip()
                if "," in line:
                    parts = line.split(",")
                    if len(parts) == 2:
                        curr = time.time()
                        # Frequenz begrenzen (max 20Hz) für flüssige UI
                        if curr - last_emit_time > 0.05:
                            try:
                                # Umrechnung (Anpassung je nach Sensor-Kalibrierung)
                                v1 = int(parts[0])
                                v2 = int(parts[1])
                                p1_bpm = int(v1 / 10) + 45
                                p2_bpm = int(v2 / 10) + 45
                                
                                state["p1_bpm"] = p1_bpm
                                state["p2_bpm"] = p2_bpm
                                
                                socketio.emit('live_pulse', {'p1': p1_bpm, 'p2': p2_bpm})
                                last_emit_time = curr
                            except: pass
        except Exception:
            print(">>> ARDUINO: Verbindung verloren", flush=True)
            ser = None
            
        time.sleep(0.01)

@socketio.on('connect')
def on_connect():
    print(">>> WEB: Browser verbunden", flush=True)
    emit('status', {'msg': 'SVR_OK'})

if __name__ == '__main__':
    # Start Hardware-Thread
    hw_thread = threading.Thread(target=hardware_worker, daemon=True)
    hw_thread.start()
    
    print(">>> SYSTEM: Server läuft auf Port 5000", flush=True)
    try:
        # allow_unsafe_werkzeug erlaubt den Start ohne kompletten Webserver-Stack (für Dev-Zwecke ideal)
        socketio.run(app, host='0.0.0.0', port=5000, log_output=False, allow_unsafe_werkzeug=True)
    except KeyboardInterrupt:
        print("\n>>> SYSTEM: Shutdown...", flush=True)
        keep_running = False
        os._exit(0)
