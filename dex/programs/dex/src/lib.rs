use anchor_lang::prelude::*;

declare_id!("76FoAxFGis6DJZYskaij151pWoiTTDvW2fPQEUP1fiLZ");

#[program]
pub mod dex {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
