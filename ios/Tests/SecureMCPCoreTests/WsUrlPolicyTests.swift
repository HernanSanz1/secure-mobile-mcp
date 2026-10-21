import XCTest
@testable import SecureMCPCore

final class WsUrlPolicyTests: XCTestCase {

    // MARK: - buildWsUrl Tests

    func testBuildWsUrl_withWsScheme_returnsUnchanged() {
        XCTAssertEqual(
            WsUrlPolicy.buildWsUrl("ws://192.168.1.1:8080"),
            "ws://192.168.1.1:8080"
        )
    }

    func testBuildWsUrl_withWssScheme_returnsUnchanged() {
        XCTAssertEqual(
            WsUrlPolicy.buildWsUrl("wss://example.com/ws"),
            "wss://example.com/ws"
        )
    }

    func testBuildWsUrl_withHttpScheme_convertsToWs() {
        XCTAssertEqual(
            WsUrlPolicy.buildWsUrl("http://192.168.1.1:8080"),
            "ws://192.168.1.1:8080"
        )
    }

    func testBuildWsUrl_withHttpsScheme_convertsToWss() {
        XCTAssertEqual(
            WsUrlPolicy.buildWsUrl("https://example.com"),
            "wss://example.com"
        )
    }

    func testBuildWsUrl_lanAddress_usesWs() {
        XCTAssertEqual(
            WsUrlPolicy.buildWsUrl("192.168.1.1:8080"),
            "ws://192.168.1.1:8080"
        )
        XCTAssertEqual(
            WsUrlPolicy.buildWsUrl("10.0.0.1:8080"),
            "ws://10.0.0.1:8080"
        )
        XCTAssertEqual(
            WsUrlPolicy.buildWsUrl("100.64.1.1:8080"),  // Tailscale CGNAT
            "ws://100.64.1.1:8080"
        )
    }

    func testBuildWsUrl_publicAddress_usesWss() {
        XCTAssertEqual(
            WsUrlPolicy.buildWsUrl("example.com:8080"),
            "wss://example.com:8080"
        )
        XCTAssertEqual(
            WsUrlPolicy.buildWsUrl("mcp.server.io"),
            "wss://mcp.server.io"
        )
    }

    func testBuildWsUrl_localhost_usesWs() {
        XCTAssertEqual(
            WsUrlPolicy.buildWsUrl("localhost:8080"),
            "ws://localhost:8080"
        )
    }

    func testBuildWsUrl_trailingSlash_removed() {
        XCTAssertEqual(
            WsUrlPolicy.buildWsUrl("example.com/"),
            "wss://example.com"
        )
    }

    // MARK: - extractHost Tests

    func testExtractHost_simple() {
        XCTAssertEqual(WsUrlPolicy.extractHost("example.com"), "example.com")
    }

    func testExtractHost_withPort() {
        XCTAssertEqual(WsUrlPolicy.extractHost("example.com:8080"), "example.com")
    }

    func testExtractHost_withScheme() {
        XCTAssertEqual(WsUrlPolicy.extractHost("wss://example.com:8080"), "example.com")
        XCTAssertEqual(WsUrlPolicy.extractHost("https://example.com"), "example.com")
    }

    func testExtractHost_withPath() {
        XCTAssertEqual(WsUrlPolicy.extractHost("example.com:8080/ws"), "example.com")
    }

    func testExtractHost_withAuth() {
        XCTAssertEqual(WsUrlPolicy.extractHost("user:pass@example.com:8080"), "example.com")
    }

    // MARK: - isLanHost Tests

    func testIsLanHost_192() {
        XCTAssertTrue(WsUrlPolicy.isLanHost("192.168.1.1"))
        XCTAssertTrue(WsUrlPolicy.isLanHost("192.0.0.1"))
    }

    func testIsLanHost_10() {
        XCTAssertTrue(WsUrlPolicy.isLanHost("10.0.0.1"))
        XCTAssertTrue(WsUrlPolicy.isLanHost("10.255.255.255"))
    }

    func testIsLanHost_tailscale() {
        XCTAssertTrue(WsUrlPolicy.isLanHost("100.64.0.1"))
        XCTAssertTrue(WsUrlPolicy.isLanHost("100.127.255.255"))
    }

    func testIsLanHost_localhost() {
        XCTAssertTrue(WsUrlPolicy.isLanHost("localhost"))
        XCTAssertTrue(WsUrlPolicy.isLanHost("127.0.0.1"))
    }

    func testIsLanHost_publicAddress() {
        XCTAssertFalse(WsUrlPolicy.isLanHost("example.com"))
        XCTAssertFalse(WsUrlPolicy.isLanHost("8.8.8.8"))
        XCTAssertFalse(WsUrlPolicy.isLanHost("mcp.server.io"))
    }
}
