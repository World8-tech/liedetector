import serial
import time

# Hier die Adresse eintragen, die wir in Schritt 2 gefunden haben
port = '/dev/ttyACM0' 

try:
    ser = serial.Serial(port, 9600, timeout=1)
    print(f"Verbunden mit {port}. Warte auf Daten...")
    
    while True:
        if ser.in_waiting > 0:
            # Lies eine Zeile vom USB
            line = ser.readline().decode('utf-8').strip()
            print(f"Daten vom Arduino: {line}")
        time.sleep(0.01)
except Exception as e:
    print(f"Fehler: {e}")