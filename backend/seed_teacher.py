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

def create_admin_user():
    """创建管理员账号"""
    db: Session = SessionLocal()
    
    try:
        from app.models.user import UserRole
        # 检查是否已存在
        existing = db.query(Teacher).filter(Teacher.username == "admin").first()
        if existing:
            print("✓ Admin account already exists")
            # 确保角色正确
            if existing.role != UserRole.admin:
                existing.role = UserRole.admin
                db.commit()
                print("  Updated admin role")
            return
        
        # 创建管理员
        admin = Teacher(
            username="admin",
            password_hash=get_password_hash("admin123"),
            email="admin@example.com",
            role=UserRole.admin,
            is_active=True
        )
        
        db.add(admin)
        db.commit()
        db.refresh(admin)
        
        print(f"✓ Created admin account:")
        print(f"  Username: admin")
        print(f"  Password: admin123")
        print(f"  ID: {admin.id}")
        
    except Exception as e:
        print(f"✗ Failed to create admin: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_default_teacher()
    create_admin_user()
