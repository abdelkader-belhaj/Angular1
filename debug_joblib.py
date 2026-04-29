import joblib
import os
import traceback

base_dir = r"C:\Users\USER\OneDrive\Bureau\ai-recommendation"
try:
    rf_pipeline = joblib.load(os.path.join(base_dir, 'advanced_rf_model.pkl'))
    db_users = joblib.load(os.path.join(base_dir, 'users_db.pkl'))
    db_logements = joblib.load(os.path.join(base_dir, 'logements_db.pkl'))
    print("SUCCESS")
except Exception as e:
    print("FAILED:", e)
    traceback.print_exc()
