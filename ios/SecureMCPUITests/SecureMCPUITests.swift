import XCTest

/// UI Tests for SecureMCP using XCUITest framework
final class SecureMCPUITests: XCTestCase {

    var app: XCUIApplication!

    override func setUpWithError() throws {
        continueAfterFailure = false
        app = XCUIApplication()
        app.launchArguments = ["--uitesting"]
        app.launch()
    }

    override func tearDownWithError() throws {
        app = nil
    }

    // MARK: - Tab Navigation Tests

    func testTabNavigation() throws {
        // Dashboard tab should be selected by default
        let dashboardTab = app.tabBars.buttons["Dashboard"]
        XCTAssertTrue(dashboardTab.isSelected)

        // Navigate to Settings
        let settingsTab = app.tabBars.buttons["Settings"]
        settingsTab.tap()
        XCTAssertTrue(settingsTab.isSelected)

        // Navigate to Logs
        let logsTab = app.tabBars.buttons["Logs"]
        logsTab.tap()
        XCTAssertTrue(logsTab.isSelected)

        // Back to Dashboard
        dashboardTab.tap()
        XCTAssertTrue(dashboardTab.isSelected)
    }

    // MARK: - Dashboard Tests

    func testDashboardShowsConnectionStatus() throws {
        // Connection status should be visible
        let statusText = app.staticTexts["Disconnected"]
        XCTAssertTrue(statusText.waitForExistence(timeout: 2))
    }

    func testDashboardShowsVPNStatus() throws {
        // VPN Tunnel section should be visible
        let vpnText = app.staticTexts["VPN Tunnel"]
        XCTAssertTrue(vpnText.waitForExistence(timeout: 2))
    }

    func testConnectButtonExists() throws {
        let connectButton = app.buttons["Connect"]
        XCTAssertTrue(connectButton.waitForExistence(timeout: 2))
        XCTAssertTrue(connectButton.isEnabled)
    }

    func testDisconnectButtonDisabledWhenNotConnected() throws {
        let disconnectButton = app.buttons["Disconnect"]
        XCTAssertTrue(disconnectButton.waitForExistence(timeout: 2))
        XCTAssertFalse(disconnectButton.isEnabled)
    }

    // MARK: - Settings Tests

    func testSettingsShowsServerConfig() throws {
        // Navigate to Settings
        app.tabBars.buttons["Settings"].tap()

        // Check for server configuration fields
        let serverUrlField = app.textFields["Server URL"]
        XCTAssertTrue(serverUrlField.waitForExistence(timeout: 2))

        let deviceNameField = app.textFields["Device Name"]
        XCTAssertTrue(deviceNameField.waitForExistence(timeout: 2))
    }

    func testSettingsServerUrlInput() throws {
        app.tabBars.buttons["Settings"].tap()

        let serverUrlField = app.textFields["Server URL"]
        serverUrlField.tap()
        serverUrlField.typeText("wss://mcp.example.com")

        XCTAssertEqual(serverUrlField.value as? String, "wss://mcp.example.com")
    }

    func testSettingsVPNConfigureButton() throws {
        app.tabBars.buttons["Settings"].tap()

        let configureButton = app.buttons["Configure WireGuard"]
        XCTAssertTrue(configureButton.waitForExistence(timeout: 2))

        configureButton.tap()

        // VPN config sheet should appear
        let privateKeyField = app.secureTextFields["Private Key"]
        XCTAssertTrue(privateKeyField.waitForExistence(timeout: 2))
    }

    // MARK: - Logs Tests

    func testLogsShowsEmptyState() throws {
        app.tabBars.buttons["Logs"].tap()

        // Should show empty state when no commands executed
        let emptyText = app.staticTexts["No Commands Yet"]
        XCTAssertTrue(emptyText.waitForExistence(timeout: 2))
    }

    func testLogsClearButtonDisabledWhenEmpty() throws {
        app.tabBars.buttons["Logs"].tap()

        let clearButton = app.buttons["Clear"]
        XCTAssertTrue(clearButton.waitForExistence(timeout: 2))
        XCTAssertFalse(clearButton.isEnabled)
    }

    // MARK: - Connection Flow Tests

    func testConnectionFlowWithoutServerUrl() throws {
        // Clear any existing server URL
        app.tabBars.buttons["Settings"].tap()

        let serverUrlField = app.textFields["Server URL"]
        serverUrlField.tap()

        // Clear field
        if let text = serverUrlField.value as? String, !text.isEmpty {
            serverUrlField.clearText()
        }

        // Go to Dashboard and try to connect
        app.tabBars.buttons["Dashboard"].tap()

        let connectButton = app.buttons["Connect"]
        // Connect should be disabled without server URL
        // (Depends on app state validation)
    }

    // MARK: - Accessibility Tests

    func testDashboardAccessibility() throws {
        // All major elements should have accessibility labels
        XCTAssertTrue(app.tabBars.buttons["Dashboard"].isHittable)
        XCTAssertTrue(app.tabBars.buttons["Settings"].isHittable)
        XCTAssertTrue(app.tabBars.buttons["Logs"].isHittable)
    }

    // MARK: - Performance Tests

    func testLaunchPerformance() throws {
        if #available(iOS 13.0, *) {
            measure(metrics: [XCTApplicationLaunchMetric()]) {
                XCUIApplication().launch()
            }
        }
    }
}

// MARK: - XCUIElement Extensions

extension XCUIElement {
    /// Clear text from a text field
    func clearText() {
        guard let stringValue = self.value as? String else { return }

        // Select all and delete
        self.tap()
        let deleteString = String(repeating: XCUIKeyboardKey.delete.rawValue, count: stringValue.count)
        self.typeText(deleteString)
    }
}
