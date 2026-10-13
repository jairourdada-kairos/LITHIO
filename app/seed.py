import sys
import os

# Esto fuerza a Python a reconocer la carpeta principal de tu proyecto
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from app.database import SessionLocal, engine
from app import models
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def seed_data():
    # Crea las tablas si no existen
    models.Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()
    email_admin = "jairourdada@gmail.com" 
    
    jairo = db.query(models.User).filter(models.User.email == email_admin).first()
    
    if not jairo:
        # Si no existe, lo crea con todos sus datos de una vez
        hashed_pw = pwd_context.hash("Kino0802*")
        jairo = models.User(
            name="Jairo Eduardo Urdaneta Gonzalez",
            email=email_admin,
            phone="+584124091527",
            role="admin",
            password_hash=hashed_pw
        )
        db.add(jairo)
        db.commit()
        print("¡Cuenta de Jairo (Admin) creada con éxito!")
    else:
        # Si ya existe, actualizamos sus datos por si cambió algo
        setattr(jairo, "name", "Jairo Eduardo Urdaneta Gonzalez")
        setattr(jairo, "phone", "+584124091527")
        setattr(jairo, "role", "admin")
        jairo.password_hash = pwd_context.hash("Kino0802*")
        db.commit()
        print("¡Cuenta de Jairo ya existía y fue actualizada con éxito!")
        
    db.close()

if __name__ == "__main__":
    seed_data()