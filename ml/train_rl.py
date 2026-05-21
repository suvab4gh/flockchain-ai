import os
import pandas as pd
from stable_baselines3 import PPO
from stable_baselines3.common.env_checker import check_env
from stable_baselines3.common.callbacks import EvalCallback

from train_models import load_and_preprocess_data
from feature_engineering import build_features
from label_generator import generate_health_score
from gym_env import PoultryFarmEnv

def train_rl_agent(df: pd.DataFrame):
    print("Initializing Poultry Farm Environment...")
    env = PoultryFarmEnv(df)
    
    # Eval on the tail of the dataset
    eval_df = df.tail(1000)
    eval_env = PoultryFarmEnv(eval_df)

    print("Checking Gymnasium environment conformity...")
    check_env(env)  # SB3 validator
    print("Environment is compliant!")

    # Create directories for logs and checkpoints
    os.makedirs("./logs", exist_ok=True)
    os.makedirs("./models", exist_ok=True)

    print("Instantiating PPO Agent...")
    model = PPO(
        policy="MlpPolicy",
        env=env,
        learning_rate=3e-4,
        n_steps=2048,
        batch_size=64,
        n_epochs=10,
        gamma=0.99,         # Care about future health outcomes
        gae_lambda=0.95,
        clip_range=0.2,
        verbose=1,
        tensorboard_log=None
    )

    eval_callback = EvalCallback(
        eval_env,
        best_model_save_path="./models/",
        log_path="./logs/",
        eval_freq=5000,
        deterministic=True
    )

    print("Training PPO Agent for 100,000 timesteps...")
    model.learn(total_timesteps=100_000, callback=eval_callback)
    
    # Save the final agent
    model.save("models/poultry_rl_agent")
    print("*** PPO Reinforcement Learning Agent saved at models/poultry_rl_agent.zip ***")
    return model

if __name__ == "__main__":
    csv_path = "../data/poultry_telemetry_historical.csv"
    if not os.path.exists(csv_path):
        csv_path = "data/poultry_telemetry_historical.csv"
        
    raw_df = load_and_preprocess_data(csv_path)
    engineered_df = build_features(raw_df)
    engineered_df["health_score"] = engineered_df.apply(generate_health_score, axis=1)
    
    train_rl_agent(engineered_df)
