import XCTest
@testable import SecureMCPCore

final class ReconnectPolicyTests: XCTestCase {

    // MARK: - reconnectDelay Tests

    func testReconnectDelay_firstAttempt() {
        let delay = ReconnectPolicy.reconnectDelay(attempts: 0)
        XCTAssertEqual(delay, 2.0, accuracy: 0.01)  // 2000ms = 2s
    }

    func testReconnectDelay_exponentialBackoff() {
        // Attempt 1: 2 * 2^1 = 4s
        XCTAssertEqual(ReconnectPolicy.reconnectDelay(attempts: 1), 4.0, accuracy: 0.01)

        // Attempt 2: 2 * 2^2 = 8s
        XCTAssertEqual(ReconnectPolicy.reconnectDelay(attempts: 2), 8.0, accuracy: 0.01)

        // Attempt 3: 2 * 2^3 = 16s
        XCTAssertEqual(ReconnectPolicy.reconnectDelay(attempts: 3), 16.0, accuracy: 0.01)
    }

    func testReconnectDelay_cappedAtMax() {
        // Should cap at 30 seconds
        let delay = ReconnectPolicy.reconnectDelay(attempts: 10)
        XCTAssertEqual(delay, 30.0, accuracy: 0.01)
    }

    func testReconnectDelay_negativeAttempts() {
        // Should treat negative as 0
        let delay = ReconnectPolicy.reconnectDelay(attempts: -5)
        XCTAssertEqual(delay, 2.0, accuracy: 0.01)
    }

    func testReconnectDelay_veryHighAttempts() {
        // Should still be capped at max
        let delay = ReconnectPolicy.reconnectDelay(attempts: 100)
        XCTAssertEqual(delay, 30.0, accuracy: 0.01)
    }

    // MARK: - ackTimedOut Tests

    func testAckTimedOut_nilLastAck() {
        XCTAssertFalse(ReconnectPolicy.ackTimedOut(lastAckAt: nil))
    }

    func testAckTimedOut_recent() {
        let recentAck = Date().addingTimeInterval(-10)  // 10 seconds ago
        XCTAssertFalse(ReconnectPolicy.ackTimedOut(lastAckAt: recentAck))
    }

    func testAckTimedOut_timedOut() {
        // More than 2 * heartbeat interval (60s) ago
        let oldAck = Date().addingTimeInterval(-70)
        XCTAssertTrue(ReconnectPolicy.ackTimedOut(lastAckAt: oldAck))
    }

    func testAckTimedOut_exactlyAtThreshold() {
        // Exactly at 2 * heartbeat interval
        let thresholdAck = Date().addingTimeInterval(-60)
        // Should not be timed out (uses > not >=)
        XCTAssertFalse(ReconnectPolicy.ackTimedOut(lastAckAt: thresholdAck))
    }
}
