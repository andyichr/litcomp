#!/usr/bin/env perl

use Switch;
use POSIX qw(SIGHUP);

use FileHandle;
use IPC::Open2;

use JSON;
use Data::Dumper;

use strict;

my @input = <STDIN>;
my $req = from_json( join( "", @input ) );

my $error = sub {
	my $message = shift;
	print STDERR "ERROR: $message";
	print STDERR "\n";
	exit 1;
};

# build shell pipeline given request
my @path = split ( ":", $ENV{PATH} );

################################################################################
# used to derive a new map having the same effect as applying two maps
# sequenially
################################################################################
sub compose_map {
	my $map_left = shift;
	my $map_right = shift;

	if ( $map_left->{"codomain"}->() && $map_left->{"codomain"}->() ne $map_right->{"domain"}->() ) {
		$error->( "cannot compose maps because codomain of map_left '" . $map_left->{"codomain"}->()
				. "' does not equal domain of map_right '" . $map_right->{"domain"}->() . "'" );
	}

	return {
		"read" => sub {
			my $buf = $map_right->{"read"}->();
			return $buf;
		},
		"write" => sub {
			my $buf = shift;
			$map_left->{"write"}->( $buf );
			my $left_buf = $map_left->{"read"}->();
			$map_right->{"write"}->( $left_buf );
		},
		"destroy" => sub {
			$map_left->{"destroy"}->();
			$map_right->{"destroy"}->();
		},
		"domain" => sub {
			my $domain = $map_left->{"domain"}->();

			if ( ! $domain ) {
				$domain = $map_right->{"domain"}->();
			}

			return $domain;
		},
		"codomain" => sub {
			my $codomain = $map_right->{"codomain"}->();
			return $codomain;
		}
	};
}
################################################################################

################################################################################
# parses map signature of form: F : D -> C
################################################################################
sub parse_map {
	my $map_name = shift;
	my @map_parts = split( " : ", $map_name );
	my $map_function = $map_parts[0];
	my @domain_parts = split( " -> ", $map_parts[1] );
	my $domain = $domain_parts[0];
	my $codomain = $domain_parts[1];

	return {
		"function" => sub { $map_function },
		"domain" => sub { $domain },
		"codomain" => sub { $codomain }
	};
}

################################################################################

################################################################################
# generates a map structure given a requested category map
################################################################################
sub model_map {
	my %args = @_;
	my $req = $args{"req"};
	my $expected_domain = $args{"expected_domain"};
	my $map = parse_map( $req->[1] );
	my $map_function = $map->{"function"}->();
	my $domain = $map->{"domain"}->();
	my $codomain = $map->{"codomain"}->();

	# support inference of the domain
	if ( $domain eq "_" ) {
		$domain = $expected_domain;
	}

	if ( $expected_domain && $domain ne $expected_domain ) {
		$error->( "domain '" . $domain . "' did not match expected value of '" . $expected_domain . "'" );
	}

	my $child_out;
	my $child_in;
	my $cmd;
	my $found_arrow;

	foreach ( @path ) {
		my $base_dir = $_;
		$cmd = $base_dir . "/" . $domain . "/" . $codomain . "/" . $map_function;

		if ( -e $cmd ) {
			$found_arrow = 1;
			last;
		}
	}

	if ( !$found_arrow ) {
		$error->( "arrow not found: $map_function : $domain -> $codomain" );
	}

	my $pid = open2( $child_out, $child_in, $cmd );

	return {
		"read" => sub {
			my $out;

			while ( my $buf = <$child_out> ) {
				$out .= $buf;
			}

			close $child_out;

			return $out;
		},
		"write" => sub {
			my $buf = shift;
			print $child_in $buf;
			close $child_in;
		},
		"destroy" => sub {
			kill SIGHUP, $pid;
		},
		"domain" => sub {
			$domain;
		},
		"codomain" => sub {
			$codomain;
		}
	};
}
################################################################################

################################################################################
# generates a map structure given a literal value
################################################################################
sub value_map {
	my $value = shift;
	my $buf = to_json $value;

	return {
		"read" => sub {
			my $result = $buf;
			$buf = undef;
			return $result;
		},
		"write" => sub {
			# do nothing since this map is a literal value
		},
		"destroy" => sub {
			# do nothing since no external resources have been allocated
		},
		"domain" => sub {
			return undef;
		},
		"codomain" => sub {
			return undef;
		}
	};
}
################################################################################

sub req_map {
	my $req = shift;

	my $type = sub {
		if ( ref( $req ) eq "ARRAY" ) {
			return $req->[0];
		} else {
			return undef;
		}
	}->();

	switch ( $type ) {

		case "map" {
			my $child_map = req_map( $req->[2] );
			return compose_map( $child_map, model_map(
				"req" => $req,
				"expected_domain" => $child_map->{"codomain"}->()
			) );
		}

		else {
			return value_map( $req );
		}

	}
}

my $req_map = req_map( $req );
$req_map->{"write"}->();
my $result = $req_map->{"read"}->();
print $result;
