// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./AssetPassportRegistryV2.sol";

contract AgentPolicyGatewayV2 is EIP712, Ownable {
    using ECDSA for bytes32;

    enum Action {
        RESTRICT_PASSPORT,
        RETIRE_PASSPORT
    }

    struct AgentAction {
        Action action;
        bytes32 passportId;
        uint256 nonce;
        uint256 deadline;
    }

    bytes32 public constant ACTION_TYPEHASH = keccak256("AgentAction(uint8 action,bytes32 passportId,uint256 nonce,uint256 deadline)");
    AssetPassportRegistryV2 public immutable passports;
    address public agent;
    mapping(uint256 => bool) public usedNonces;

    error InvalidAddress();
    error InvalidAgent();
    error AuthorizationExpired();
    error NonceUsed();
    error InvalidSignature();
    error UnsupportedAction();

    event AgentChanged(address indexed previousAgent, address indexed newAgent);
    event AgentActionExecuted(Action indexed action, bytes32 indexed passportId, uint256 indexed nonce);

    constructor(AssetPassportRegistryV2 passports_, address agent_) EIP712("XLayerEstateAgent", "1") Ownable() {
        if (address(passports_) == address(0) || agent_ == address(0)) revert InvalidAddress();
        passports = passports_;
        agent = agent_;
    }

    function setAgent(address newAgent) external onlyOwner {
        if (newAgent == address(0)) revert InvalidAgent();
        emit AgentChanged(agent, newAgent);
        agent = newAgent;
    }

    function execute(AgentAction calldata action, bytes calldata signature) external {
        if (action.deadline < block.timestamp) revert AuthorizationExpired();
        if (usedNonces[action.nonce]) revert NonceUsed();
        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(ACTION_TYPEHASH, action.action, action.passportId, action.nonce, action.deadline)));
        if (digest.recover(signature) != agent) revert InvalidSignature();
        usedNonces[action.nonce] = true;
        if (action.action == Action.RESTRICT_PASSPORT) {
            passports.setPassportStatus(action.passportId, AssetPassportRegistryV2.Status.RESTRICTED);
        } else if (action.action == Action.RETIRE_PASSPORT) {
            passports.setPassportStatus(action.passportId, AssetPassportRegistryV2.Status.RETIRED);
        } else {
            revert UnsupportedAction();
        }
        emit AgentActionExecuted(action.action, action.passportId, action.nonce);
    }
}
