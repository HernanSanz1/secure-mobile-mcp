// swift-tools-version:5.9
import PackageDescription

let package = Package(
    name: "SecureMCP",
    platforms: [
        .iOS(.v15),
        .macOS(.v12)
    ],
    products: [
        .library(
            name: "SecureMCPCore",
            targets: ["SecureMCPCore"]
        ),
    ],
    dependencies: [
        .package(url: "https://github.com/WireGuard/wireguard-apple", from: "1.0.16"),
    ],
    targets: [
        .target(
            name: "SecureMCPCore",
            dependencies: [
                .product(name: "WireGuardKit", package: "wireguard-apple"),
            ],
            path: "Sources/SecureMCPCore"
        ),
        .testTarget(
            name: "SecureMCPCoreTests",
            dependencies: ["SecureMCPCore"],
            path: "Tests/SecureMCPCoreTests"
        ),
    ]
)
