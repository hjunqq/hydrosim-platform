"""Add deploying status to deployment enum

Revision ID: 4a6b2c1d9f7e
Revises: 7f6a3f2b9c1d
Create Date: 2026-01-02 19:05:00.000000

"""
from typing import Sequence, Union

from alembic import op


# revision identifiers, used by Alembic.
revision: str = "4a6b2c1d9f7e"
down_revision: Union[str, None] = "7f6a3f2b9c1d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE deployment_status_enum ADD VALUE IF NOT EXISTS 'deploying'")


def downgrade() -> None:
    pass
