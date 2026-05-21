def generate_health_score(row) -> float:
    """
    Returns health score 0.0 (critical) → 1.0 (healthy)
    Use this as the supervised label for your LSTM/XGBoost
    """
    score = 1.0

    # NH3 penalty
    if   row["nh3"] > 50: score -= 0.35
    elif row["nh3"] > 25: score -= 0.20
    elif row["nh3"] > 15: score -= 0.08

    # CO2 penalty
    if   row["co2"] > 3000: score -= 0.20
    elif row["co2"] > 2000: score -= 0.10

    # Temperature stress
    temp_dev = abs(row["temperature"] - 23)
    score -= min(0.20, temp_dev * 0.03)

    # Humidity stress
    humid_dev = abs(row["humidity"] - 60)
    score -= min(0.15, humid_dev * 0.005)

    # THI heat stress
    if   row["thi"] > 84: score -= 0.25
    elif row["thi"] > 79: score -= 0.15
    elif row["thi"] > 72: score -= 0.05

    # Mortality spike penalty
    if row.get("mortality_count", 0) > 0:
        score -= min(0.30, row["mortality_count"] * 0.05)

    return round(max(0.0, min(1.0, score)), 3)
