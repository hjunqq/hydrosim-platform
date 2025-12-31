"""Add student domain settings fields

Revision ID: 1c2d3e4f5a6b
Revises: 705f1561b779
Create Date: 2026-01-05 00:01:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "1c2d3e4f5a6b"
down_revision: Union[str, None] = "705f1561b779"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("system_settings", sa.Column("student_domain_prefix", sa.String(), nullable=True))
    op.add_column("system_settings", sa.Column("student_domain_base", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("system_settings", "student_domain_base")
    op.drop_column("system_settings", "student_domain_prefix")
