#!/usr/bin/env python3
"""
KukkutRaksha AI - Synthetic Poultry Farm Telemetry Generator
Generates realistic hourly time-series data for poultry shed environments,
correlating indoor sensor drift, outdoor weather patterns, and disease outbreaks.
"""

import os
import csv
import math
import random
from datetime import datetime, timedelta

def generate_synthetic_dataset(output_path, days=90):
    start_time = datetime.now() - timedelta(days=days)
    headers = [
        "timestamp", "sensor_id", "nh3_ppm", "co2_ppm", "temperature_c", 
        "humidity_percent", "tds_ppm", "outdoor_temp_c", "outdoor_humidity_percent",
        "pressure_hpa", "wind_speed_ms", "rain_forecast", "outbreak_occurred",
        "mortality_count", "pfsi_score"
    ]
    
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    
    with open(output_path, "w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(headers)
        
        # Base environmental settings
        nh3_base = 12.0
        co2_base = 750.0
        temp_base = 24.0
        hum_base = 60.0
        tds_base = 300.0
        
        for hour in range(days * 24):
            current_time = start_time + timedelta(hours=hour)
            
            # Diurnal temperature oscillation (outdoor: warmer at 2 PM, cooler at 4 AM)
            hour_of_day = current_time.hour
            diurnal_temp = math.sin((hour_of_day - 8) * math.pi / 12) * 5.0
            
            # Outdoor weather modeling (humid tropical West Bengal climate)
            outdoor_temp = round(28.0 + diurnal_temp + random.uniform(-1.5, 1.5), 1)
            outdoor_humidity = round(70.0 - diurnal_temp * 3 + random.uniform(-5, 5), 1)
            outdoor_humidity = max(20.0, min(100.0, outdoor_humidity))
            
            pressure = round(1008.0 + math.cos(hour * math.pi / 24) * 3 + random.uniform(-1, 1), 1)
            wind_speed = round(max(0.5, 2.5 + math.sin(hour * math.pi / 6) * 1.5 + random.uniform(-0.5, 0.5)), 1)
            
            # Rain forecast modeling
            is_raining = random.random() < 0.15 if outdoor_humidity > 80 else False
            rain_forecast = "Rain expected" if is_raining else "No rain expected"
            
            # Indoor environment correlates with outdoor, but has high baseline drift
            # Heat stress: high outdoor temp heats up shed if ventilation isn't perfect
            temp_offset = max(0, outdoor_temp - 30) * 0.4
            indoor_temp = round(temp_base + diurnal_temp * 0.3 + temp_offset + random.uniform(-0.5, 0.5), 1)
            
            # Dampness: high outdoor humidity leads to high indoor humidity
            indoor_humidity = round(hum_base + (outdoor_humidity - hum_base) * 0.5 + random.uniform(-3, 3), 1)
            indoor_humidity = max(10.0, min(100.0, indoor_humidity))
            
            # Ammonia (NH3) increases as bedding gets damp (humidity > 75%) or hot (temp > 30)
            dampness_impact = max(0, indoor_humidity - 70) * 0.8
            heat_impact = max(0, indoor_temp - 28) * 1.2
            indoor_nh3 = round(max(2.0, nh3_base + dampness_impact + heat_impact + random.uniform(-1, 1)), 1)
            
            # CO2 accumulates continuously if airflow is restricted
            indoor_co2 = round(max(400.0, co2_base + (indoor_nh3 * 15) + random.uniform(-20, 20)), 1)
            
            # TDS represents water quality
            indoor_tds = round(max(50.0, tds_base + random.uniform(-15, 15)), 1)
            
            # Outbreak occurrence probability: high under prolonged damp/NH3 accumulation
            outbreak_risk = (indoor_nh3 / 50.0) * 0.6 + (indoor_humidity / 100.0) * 0.4
            outbreak_occurred = 1 if (random.random() < outbreak_risk * 0.15 and indoor_nh3 > 25) else 0
            
            # Mortality occurs on extreme gas levels or high heat/outbreaks
            mortality = 0
            if indoor_nh3 > 50 or indoor_temp > 34:
                mortality = random.choices([0, 1, 2, 3], weights=[0.6, 0.25, 0.10, 0.05])[0]
            elif outbreak_occurred == 1:
                mortality = random.choices([0, 1, 2, 5, 8], weights=[0.2, 0.3, 0.3, 0.15, 0.05])[0]
            
            # Calculate dynamic PFSI Score (0 to 100)
            nh3_score = max(0, 100 - (indoor_nh3 / 50.0) * 100)
            co2_score = max(0, 100 - ((indoor_co2 - 400.0) / 2600.0) * 100)
            air_score = (nh3_score + co2_score) / 2.0
            
            water_score = max(0, 100 - (indoor_tds / 500.0) * 30) if indoor_tds <= 500 else max(0, 70 - ((indoor_tds - 500) / 500) * 70)
            temp_score = max(0, 100 - abs(indoor_temp - 23.0) * 10.0)
            humidity_score = max(0, 100 - abs(indoor_humidity - 60.0) * 2.0)
            adaptability_score = min(100.0, max(0.0, 100.0 - abs(indoor_temp - outdoor_temp) * 5.0))
            
            pfsi_score = round(
                (air_score * 0.30) + 
                (water_score * 0.20) + 
                (temp_score * 0.15) + 
                (humidity_score * 0.15) + 
                (adaptability_score * 0.20), 1
            )
            
            writer.writerow([
                current_time.isoformat(), 1, indoor_nh3, indoor_co2, indoor_temp, 
                indoor_humidity, indoor_tds, outdoor_temp, outdoor_humidity,
                pressure, wind_speed, rain_forecast, outbreak_occurred,
                mortality, pfsi_score
            ])
            
    print(f"SUCCESS: Successfully generated dataset at: {output_path}")

if __name__ == "__main__":
    generate_synthetic_dataset("data/poultry_telemetry_historical.csv", days=90)
