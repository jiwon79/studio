"""Read retries and restart safety against a local DB and mocked Meta transport."""
from datetime import UTC, datetime

import httpx
import pytest

from app import config, db, full_sync, instagram_client
from app.instagram_client import GraphClient, InstagramHaltedError, InstagramService, MetaApiError


@pytest.fixture
def graph(monkeypatch):
    original = httpx.Client
    delays = []
    monkeypatch.setattr(instagram_client.time, "sleep", delays.append)
    monkeypatch.setattr(instagram_client.random, "uniform", lambda *_: 0.5)

    def install(handler):
        monkeypatch.setattr(instagram_client.httpx, "Client", lambda **kwargs: original(
            transport=httpx.MockTransport(handler), **kwargs))
        return GraphClient("private-token", "ig-1", "studio.jiiwon")
    return install, delays


def error(status=500, code=2, **extra):
    return httpx.Response(status, json={"error": {"code": code, "message": "temporary", **extra}})


@pytest.mark.parametrize("failure", ["server", "timeout", "html", "transient"])
def test_get_retries_same_query_then_succeeds(graph, failure):
    install, delays = graph
    calls = []

    def respond(request):
        calls.append(request)
        if len(calls) == 1:
            if failure == "timeout":
                raise httpx.ReadTimeout("timeout", request=request)
            if failure == "html":
                return httpx.Response(502, text="upstream unavailable")
            if failure == "transient":
                return error(400, 999, is_transient=True)
            return error()
        return httpx.Response(200, json={"data": [{"id": "m1"}]})

    client = install(respond)
    params = {"fields": "id,message", "after": "same-cursor", "limit": 20}
    assert client.request("GET", "/thread/messages", params=params)["data"] == [{"id": "m1"}]
    assert calls[0].url == calls[1].url
    assert delays == [1.5]
    assert params["after"] == "same-cursor"


def test_get_retry_exhaustion_keeps_final_trace_and_bounds_backoff(graph):
    install, delays = graph
    calls = []

    def respond(request):
        calls.append(request)
        return error(fbtrace_id=f"trace-{len(calls)}")

    with pytest.raises(MetaApiError) as caught:
        install(respond).request("GET", "/me/media")
    assert len(calls) == instagram_client.GET_ATTEMPTS
    assert caught.value.trace_id == "trace-6"
    assert delays == [1.5, 2.5, 4.5, 8.5, 16.5]


@pytest.mark.parametrize("method", ["POST", "DELETE"])
@pytest.mark.parametrize("failure", ["server", "timeout", "reduce"])
def test_writes_never_retry(graph, method, failure):
    install, delays = graph
    calls = []

    def respond(request):
        calls.append(request)
        if failure == "timeout":
            raise httpx.ReadTimeout("timeout", request=request)
        if failure == "reduce":
            return error(code=1, message="Please reduce the amount of data you're asking for, then retry your request")
        return error()

    with pytest.raises(instagram_client.InstagramAssistantError):
        install(respond).request(method, "/ig-1/messages", params={"limit": 20})
    assert len(calls) == 1
    assert delays == []


@pytest.mark.parametrize("code,status,exception", [
    (190, 400, MetaApiError), (100, 400, MetaApiError),
    (4, 500, InstagramHaltedError), (613, 429, InstagramHaltedError),
])
def test_permanent_errors_and_rate_limits_do_not_retry(graph, code, status, exception):
    install, delays = graph
    calls = []

    def respond(request):
        calls.append(request)
        return error(status, code)

    with pytest.raises(exception):
        install(respond).request("GET", "/me/conversations")
    assert len(calls) == 1
    assert delays == []


def test_reduce_data_retries_same_cursor_with_smaller_pages_without_dropping_fields(graph):
    install, delays = graph
    calls = []

    def respond(request):
        query = dict(request.url.params)
        calls.append(query)
        if int(query["limit"]) > 2:
            return error(code=1, message="Please reduce the amount of data you're asking for, then retry your request")
        if query["after"] == "initial":
            return httpx.Response(200, json={"data": [{"id": "m2"}],
                "paging": {"next": "ignored-url", "cursors": {"after": "older"}}})
        return httpx.Response(200, json={"data": [{"id": "m3"}]})

    client = install(respond)
    initial = {"data": [{"id": "m1"}],
               "paging": {"next": "ignored-url", "cursors": {"after": "initial"}}}
    assert list(client.nested_pages("/thread/messages", initial,
        fields=instagram_client.DM_MESSAGE_FIELDS, page_size=20)) == [
            {"id": "m1"}, {"id": "m2"}, {"id": "m3"}]
    assert [int(call["limit"]) for call in calls[:4]] == [20, 10, 5, 2]
    assert {call["after"] for call in calls[:4]} == {"initial"}
    assert {call["fields"] for call in calls} == {instagram_client.DM_MESSAGE_FIELDS}


def test_reduce_data_stops_at_one_and_preserves_caller_query(graph):
    install, _ = graph
    calls = []

    def respond(request):
        calls.append(dict(request.url.params))
        return error(code=1, message="Please reduce the amount of data you're asking for, then retry your request")

    params = {"limit": 20, "after": "cursor"}
    with pytest.raises(MetaApiError):
        install(respond).request("GET", "/thread/messages", params=params)
    assert [int(call["limit"]) for call in calls] == [20, 10, 5, 2, 1]
    assert params == {"limit": 20, "after": "cursor"}


def test_full_sync_failure_resumes_without_duplicates_or_lost_review_state(graph, monkeypatch, tmp_path):
    install, _ = graph
    monkeypatch.setattr(config.paths, "database", tmp_path / "assistant.sqlite3")
    monkeypatch.setattr(config.paths, "data", tmp_path)
    db.initialize()
    previous = "2026-10-01T00:00:00+00:00"
    progress = {"phase": "dm", "cursor": "conversation-start"}
    db.update_settings({"full_sync_progress": progress, "last_full_sync_at": previous})
    db.upsert_event({"id": "dm:new", "account_id": "ig-1", "kind": "dm", "source_id": "new",
                     "body": "hello", "status": "ignored"})
    db.update_event("dm:new", {"draft": "saved draft"})
    failing = True
    conversation_cursors = []

    def message(mid):
        return {"id": mid, "from": {"id": "visitor"}, "message": "hello",
                "created_time": datetime.now(UTC).isoformat(),
                "reactions": {"data": [{"users": [{"id": "own"}], "emoji": "❤"}]},
                "shares": {"data": [{"link": "https://www.instagram.com/p/ABC/"}]}}

    def respond(request):
        assert request.method == "GET"
        path = request.url.path
        if path.endswith("/me/conversations"):
            conversation_cursors.append(request.url.params.get("after"))
            return httpx.Response(200, json={"data": [{"id": "thread", "updated_time": "now"}]})
        if path.endswith("/thread"):
            fields = request.url.params["fields"]
            assert "messages.limit(20)" in fields
            assert ",to," not in fields
            return httpx.Response(200, json={"participants": {"data": [
                {"id": "own", "username": "studio.jiiwon"}, {"id": "visitor", "username": "visitor"}]},
                "messages": {"data": [message("new")], "paging": {
                    "next": "next", "cursors": {"after": "message-cursor"}}}})
        assert path.endswith("/thread/messages")
        if failing:
            return error()
        # Meta pages may overlap. Replay must still leave one DB record per message.
        return httpx.Response(200, json={"data": [message("new"), message("old")]})

    service = InstagramService()
    service._client = install(respond)
    monkeypatch.setattr(full_sync, "instagram_service", service)
    with pytest.raises(MetaApiError):
        full_sync.run_if_due()
    assert db.get_settings()["full_sync_progress"] == progress
    assert db.get_settings()["last_full_sync_at"] == previous
    assert db.get_dm_sync_state("ig-1", "thread") is None
    assert db.get_event("dm:old") is None
    failing = False
    assert full_sync.run_if_due()["complete"] is True
    assert conversation_cursors == ["conversation-start", "conversation-start"]
    assert db.get_settings()["full_sync_progress"] is None
    assert db.get_settings()["last_full_sync_at"] != previous
    assert db.get_dm_sync_state("ig-1", "thread")["updated_time"] == "now"
    assert len(db.list_conversation_messages("thread")) == 2
    stored = db.get_event("dm:new")
    assert stored["status"] == "ignored" and stored["draft"] == "saved draft"
    assert stored["shared_url"] == "https://www.instagram.com/p/ABC/"
    assert stored["own_reaction"] == "❤"


def test_initial_nested_message_page_can_shrink_without_losing_required_fields(graph):
    install, _ = graph
    calls = []
    original = ("participants{id,username},messages.limit(20){"
                + instagram_client.DM_MESSAGE_FIELDS + "}")

    def respond(request):
        fields = request.url.params["fields"]
        calls.append(fields)
        if "messages.limit(20)" in fields:
            return error(code=1, message="Please reduce the amount of data you're asking for, then retry your request")
        return httpx.Response(200, json={"messages": {"data": []}})

    params = {"fields": original}
    assert install(respond).request("GET", "/thread", params=params) == {"messages": {"data": []}}
    assert calls == [original, original.replace("messages.limit(20)", "messages.limit(10)")]
    assert params["fields"] == original


def test_nested_pages_honor_total_limit_and_follow_empty_message_pages(graph):
    install, _ = graph
    calls = []

    def respond(request):
        after = request.url.params["after"]
        calls.append(after)
        if after == "empty":
            return httpx.Response(200, json={"data": [], "paging": {
                "next": "next", "cursors": {"after": "old"}}})
        return httpx.Response(200, json={"data": [{"id": "m2"}, {"id": "m3"}]})

    initial = {"data": [{"id": "m1"}], "paging": {
        "next": "next", "cursors": {"after": "empty"}}}
    client = install(respond)
    assert list(client.nested_pages("/thread/messages", initial, fields="id", limit=2,
                                   page_size=20)) == [{"id": "m1"}, {"id": "m2"}]
    assert calls == ["empty", "old"]
