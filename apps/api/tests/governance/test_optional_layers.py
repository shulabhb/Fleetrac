from app.db.models import System
from app.governance.repos import connect_public_repo
from app.intelligence.drafts import draft_explanation


def test_public_repo_rejects_non_https(db_session):
    system = System(
        id="sys-test-repo",
        display_id="T01",
        name="Test",
        owner_team="Model Risk Management",
        team_lead="A",
        default_reviewer="B",
    )
    db_session.add(system)
    db_session.flush()
    try:
        connect_public_repo(db_session, system, "git@github.com:org/private.git")
        raised = False
    except ValueError:
        raised = True
    assert raised
    assert system.code_status == "fetch_failed"


def test_draft_falls_back_without_ollama(monkeypatch):
    def boom(*_args, **_kwargs):
        raise OSError("ollama down")

    monkeypatch.setattr("urllib.request.urlopen", boom)
    draft = draft_explanation("Unsupported claim rate was above the allowed line.")
    assert draft["source"] == "template"
    assert "Unsupported claim" in draft["summary"]
