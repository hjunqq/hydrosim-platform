"""Fix teacher password hash in database."""
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.models.user import Teacher
from app.core.security import get_password_hash, verify_password

def fix_password():
    db: Session = SessionLocal()
    try:
        teacher = db.query(Teacher).filter(Teacher.username == "teacher").first()
        if not teacher:
            print("Teacher not found!")
            return

        print(f"Current broken hash: {teacher.password_hash}")

        # Generate new hash using local environment
        new_password = "teacher123"
        new_hash = get_password_hash(new_password)
        
        print(f"New hash generated: {new_hash}")
        
        teacher.password_hash = new_hash
        db.commit()
        
        # Verify immediately
        if verify_password(new_password, new_hash):
             print("SUCCESS: Password updated and verified locally.")
        else:
             print("ERROR: Generated hash could not be verified! (Environment issue?)")

    except Exception as e:
        print(f"Error: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    fix_password()
