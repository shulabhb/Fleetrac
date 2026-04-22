from app.sample_data.bob_data import BOB_STORE


def list_investigations(
    status: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
):
    items = BOB_STORE["investigations"]
    if status:
        items = [i for i in items if i.status == status]
    if target_type:
        items = [i for i in items if i.target_type == target_type]
    if target_id:
        items = [i for i in items if i.target_id == target_id]
    return items


def get_investigation(investigation_id: str):
    return next(
        (item for item in BOB_STORE["investigations"] if item.id == investigation_id),
        None,
    )


def get_investigation_for_target(target_type: str, target_id: str):
    return next(
        (
            item
            for item in BOB_STORE["investigations"]
            if item.target_type == target_type and item.target_id == target_id
        ),
        None,
    )


def list_recommendations(
    status: str | None = None,
    target_type: str | None = None,
    target_id: str | None = None,
):
    items = BOB_STORE["recommendations"]
    if status:
        items = [i for i in items if i.approval_status == status]
    if target_type:
        items = [i for i in items if i.target_type == target_type]
    if target_id:
        items = [i for i in items if i.target_id == target_id]
    return items
