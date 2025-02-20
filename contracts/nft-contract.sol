// SPDX-License-Identifier: MIT
// Compatible with OpenZeppelin Contracts ^5.0.0
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract MyNFT is ERC721, ERC721Burnable, Ownable {
    using Strings for uint256;

    uint256 private _tokenIds;
    mapping(uint256 => string) private _tokenURIs;  // Store the full tokenURI
    string private _contractURI;

    constructor(
        string memory name,
        string memory symbol,
        address initialOwner
    ) ERC721(name, symbol) Ownable(initialOwner) {}

    function mint(
        string memory uri  // Pass in the full tokenURI
    ) public {
        uint256 newTokenId = _tokenIds++;
        _safeMint(msg.sender, newTokenId);
        _tokenURIs[newTokenId] = uri;  // Store the URI
    }

    function tokenURI(uint256 tokenId)
        public
        view
        virtual
        override
        returns (string memory)
    {
        require(_ownerOf(tokenId) != address(0), "ERC721: invalid token ID");
        return _tokenURIs[tokenId];  // Return the stored URI
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }

    function setContractURI(string memory uri) public onlyOwner {
        _contractURI = uri;
    }

    function contractURI() public view returns (string memory) {
        return _contractURI;
    }
}
