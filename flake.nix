inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    solana.url = "github:solana-labs/solana";
    anchor.url = "github:project-serum/anchor";
    rust-overlay.url = "github:oxalica/rust-overlay";
  };

  outputs = { self, nixpkgs, solana-nix, ... }:
  let
    system = "x86_64-linux"; # or your system architecture
    pkgs = import nixpkgs { inherit system; };
  in {
    devShells.${system}.default = pkgs.mkShell {
      buildInputs = [
        solana-nix.packages.${system}.solana
      ];
    };
  };
}