import gymnasium as gym
from gymnasium import spaces
import pandas as pd
import numpy as np

class PoultryFarmEnv(gym.Env):
    """
    State:  [health_score, nh3, co2, temperature, humidity, thi,
             outdoor_temp, time_of_day_sin, time_of_day_cos]
    Actions: 0=fan_low, 1=fan_medium, 2=fan_high,
             3=heater_on, 4=heater_off, 5=alert_farmer
    """
    def __init__(self, historical_df: pd.DataFrame):
        super().__init__()
        self.df = historical_df.reset_index(drop=True)
        self.idx = 0

        # Define continuous observation space
        self.observation_space = spaces.Box(
            low  = np.array([0, 0, 0, 0, 0, 0, -20, -1, -1]),
            high = np.array([1, 100, 5000, 50, 100, 100, 50, 1, 1]),
            dtype=np.float32
        )
        
        # Define discrete action space (6 options)
        self.action_space = spaces.Discrete(6)

        # Track actuator states
        self.fan_level  = 1   # 0=low, 1=med, 2=high
        self.heater_on  = False

    def _get_obs(self):
        row = self.df.iloc[self.idx]
        hour = pd.Timestamp(row["timestamp"]).hour
        return np.array([
            row["health_score"],
            row["nh3"],
            row["co2"],
            row["temperature"],
            row["humidity"],
            row["thi"],
            row["outdoor_temp"],
            np.sin(2 * np.pi * hour / 24),
            np.cos(2 * np.pi * hour / 24)
        ], dtype=np.float32)

    def step(self, action):
        row = self.df.iloc[self.idx]
        prev_health = row["health_score"]

        # Apply action effect (simulate environment response)
        nh3_effect, temp_effect, energy_cost = 0, 0, 0
        if   action == 0: self.fan_level = 0; nh3_effect = +2;  energy_cost = 0.1
        elif action == 1: self.fan_level = 1; nh3_effect = 0;   energy_cost = 0.3
        elif action == 2: self.fan_level = 2; nh3_effect = -5;  energy_cost = 0.6
        elif action == 3: self.heater_on = True;  temp_effect = +1; energy_cost = 0.5
        elif action == 4: self.heater_on = False; temp_effect = -1; energy_cost = 0.0
        elif action == 5: energy_cost = 0.0   # alert — handled externally

        self.idx = min(self.idx + 1, len(self.df) - 1)
        next_row = self.df.iloc[self.idx]
        next_health = next_row["health_score"]

        # --- REWARD FUNCTION ---
        health_delta    = (next_health - prev_health) * 10
        gas_penalty     = -2.0 if next_row["nh3"] > 25 else 0
        gas_penalty    += -4.0 if next_row["nh3"] > 50 else 0
        energy_penalty  = -energy_cost
        alert_penalty   = -0.5 if action == 5 and next_row["nh3"] < 20 else 0
        mortality_bonus = +3.0 if next_row.get("mortality_count", 0) == 0 else -5.0
        weather_bonus   = +1.0 if abs(next_row["temp_delta"]) < 5 else 0

        reward = (health_delta + gas_penalty + energy_penalty +
                  alert_penalty + mortality_bonus + weather_bonus)

        done = self.idx >= len(self.df) - 1
        return self._get_obs(), reward, done, False, {}

    def reset(self, seed=None, options=None):
        super().reset(seed=seed)
        self.idx = np.random.randint(0, len(self.df) // 2)
        self.fan_level = 1
        self.heater_on = False
        return self._get_obs(), {}
