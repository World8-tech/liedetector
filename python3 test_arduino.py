import serial
import time
import threading
from flask import Flask, render_template
from flask_socketio import SocketIO, emit

app = Flask(__name__)
socketio = SocketIO(app)

# Arduino Verbindung
try:
    ser = serial.Serial('/dev/ttyACM0', 9600, timeout=1)
except:
    ser = None
    print("Arduino nicht gefunden!")

# Speicher für die letzten Werte
data_storage = {"p1": 0, "p2": 0}

def read_arduino():
    while True:
        if ser and ser.in_waiting > 0:
            try:
                line = ser.readline().decode('utf-8').strip()
                if "," in line:
                    parts = line.split(",")
                    # Wir schicken die ROHWERTE (600-800) direkt an die WebApp
                    v1 = int(parts[0])
                    v2 = int(parts[1])
                    
                    socketio.emit('raw_data', {'p1': v1, 'p2': v2})
            except:
                pass
        time.sleep(0.05) # 20 Messungen pro Sekunde

threading.Thread(target=read_arduino, daemon=True).start()

@app.route('/')
def index():
    return render_template('index.html')

if __name__ == '__main__':
    socketio.run(app, host='0.0.0.0', port=5000)
