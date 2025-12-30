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

def seed_students():
    """为现有学生初始化默认密码"""
    db: Session = SessionLocal()
    try:
        from app.models.student import Student
        students = db.query(Student).filter(Student.password_hash == None).all()
        if not students:
            print("✓ All students already have passwords or no students found")
            return
            
        default_pwd_hash = get_password_hash("student123")
        for s in students:
            s.password_hash = default_pwd_hash
            s.role = "student"
            s.is_active = True
            
        db.commit()
        print(f"✓ Initialized passwords for {len(students)} students")
    except Exception as e:
        print(f"✗ Failed to seed students: {e}")
        db.rollback()
    finally:
        db.close()

def create_test_student():
    """创建一个特定的测试学生账号"""
    db: Session = SessionLocal()
    try:
        from app.models.student import Student, ProjectType
        # 检查是否已存在
        existing = db.query(Student).filter(Student.student_code == "student").first()
        if existing:
            print("✓ Test student account 'student' already exists")
            return
            
        # 创建测试学生
        student = Student(
            student_code="student",
            name="测试学生",
            password_hash=get_password_hash("student123"),
            project_type=ProjectType.gd,
            git_repo_url="https://github.com/example/test-project",
            is_active=True,
            role="student"
        )
        
        db.add(student)
        db.commit()
        print(f"✓ Created test student account:")
        print(f"  Username (student_code): student")
        print(f"  Password: student123")
    except Exception as e:
        print(f"✗ Failed to create test student: {e}")
        db.rollback()
    finally:
        db.close()

if __name__ == "__main__":
    create_default_teacher()
    create_admin_user()
    seed_students()
    create_test_student()
