"""Seed initial teacher account to database."""
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.core.security import get_password_hash
from app.models.user import Teacher


def create_default_teacher():
    """创建默认教师账号"""
    db: Session = SessionLocal()
    
    try:
        # 检查是否已存在
        existing = db.query(Teacher).filter(Teacher.username == "teacher").first()
        if existing:
            print("✓ Default teacher account already exists")
            return
        
        # 创建默认账号
        teacher = Teacher(
            username="teacher",
            password_hash=get_password_hash("teacher123"),  # 默认密码
            email="teacher@example.com",
            is_active=True
        )
        
        db.add(teacher)
        db.commit()
        db.refresh(teacher)
        
        print(f"✓ Created default teacher account:")
        print(f"  Username: teacher")
        print(f"  Password: teacher123")
        print(f"  ID: {teacher.id}")
        
    except Exception as e:
        print(f"✗ Failed to create teacher: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    create_default_teacher()
