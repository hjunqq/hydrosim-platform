"""Add deploy keys to build_configs and job_name to builds

Revision ID: 7f6a3f2b9c1d
Revises: ce409d0a915d
Create Date: 2026-01-02 18:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = "7f6a3f2b9c1d"
down_revision: Union[str, None] = "ce409d0a915d"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("build_configs", sa.Column("deploy_key_public", sa.Text(), nullable=True))
    op.add_column("build_configs", sa.Column("deploy_key_private", sa.Text(), nullable=True))
    op.add_column("build_configs", sa.Column("deploy_key_fingerprint", sa.String(), nullable=True))
    op.add_column("build_configs", sa.Column("deploy_key_created_at", sa.DateTime(timezone=True), nullable=True))
    op.add_column("builds", sa.Column("job_name", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("builds", "job_name")
    op.drop_column("build_configs", "deploy_key_created_at")
    op.drop_column("build_configs", "deploy_key_fingerprint")
    op.drop_column("build_configs", "deploy_key_private")
    op.drop_column("build_configs", "deploy_key_public")
