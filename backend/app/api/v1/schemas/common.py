from pydantic import BaseModel


class ClusterOption(BaseModel):
    value: str
    label: str
