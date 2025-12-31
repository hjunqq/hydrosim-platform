from sqlalchemy import Column, Integer, String
from app.db.base_class import Base

class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    platform_name = Column(String, default="毕业设计项目管理平台")
    portal_title = Column(String, default="Hydrosim Portal")
    env_type = Column(String, default="demo") # production, test, demo
    domain_name = Column(String, nullable=True)
    student_domain_prefix = Column(String, default="stu-")
    student_domain_base = Column(String, default="hydrosim.cn")
    contact_email = Column(String, nullable=True)
    help_url = Column(String, nullable=True)
    footer_text = Column(String, nullable=True)
